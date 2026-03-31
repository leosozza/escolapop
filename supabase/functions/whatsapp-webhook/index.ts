import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WUZAPI_URL = (Deno.env.get("WUZAPI_URL") || "").replace(/\/+$/, "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Raw type:", body.type, "instanceName:", body.instanceName, "userID:", body.userID, "state:", body.state);

    const eventType = typeof body.type === "string" ? body.type : (typeof body.event === "string" ? body.event : null);
    const eventData = (typeof body.event === "object" && body.event !== null) ? body.event : body.data || body;
    const instanceName = body.instanceName || "";
    const userID = body.userID || "";

    console.log("Parsed eventType:", eventType);

    // ---- RESOLVE INSTANCE ----
    const findInstance = async (): Promise<{ id: string; wuzapi_token: string | null } | null> => {
      if (userID) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id, wuzapi_token")
          .eq("wuzapi_user_id", userID)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      if (instanceName) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id, wuzapi_token")
          .ilike("name", instanceName)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, wuzapi_token")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      return data || null;
    };

    const instance = await findInstance();
    const instanceId = instance?.id || null;
    const instanceToken = instance?.wuzapi_token || null;
    console.log("Resolved instanceId:", instanceId);

    // ============ MESSAGE EVENTS ============
    if (eventType === "Message") {
      const info = eventData.Info || {};
      const isFromMe = info.IsFromMe === true;
      const isGroup = info.IsGroup === true;

      if (isGroup) {
        console.log("Skipping group message");
        return okResponse();
      }

      let phone = "";
      if (isFromMe) {
        const recipientAlt = info.RecipientAlt || "";
        const chat = info.Chat || "";
        phone = extractPhone(recipientAlt) || extractPhone(chat);
      } else {
        const senderAlt = info.SenderAlt || "";
        const sender = info.Sender || "";
        phone = extractPhone(senderAlt) || extractPhone(sender);
      }

      const pushName = info.PushName || "";
      const msgId = info.ID || "";

      console.log("Message:", { phone, pushName, msgId, isFromMe, isGroup });

      if (!phone) {
        console.log("No phone extracted, skipping");
        return okResponse();
      }

      // isFromMe messages are processed normally (direction=outbound) with dedup

      const message = eventData.Message || eventData.RawMessage || {};

      // ---- HANDLE REACTIONS ----
      if (message.reactionMessage) {
        const reaction = message.reactionMessage;
        const emoji = reaction.text || "";
        const originalMsgId = reaction.key?.id || "";

        console.log("Reaction:", { emoji, originalMsgId, phone });

        if (emoji && originalMsgId) {
          // Lookup lead_id from the original message
          let reactionLeadId: string | null = null;
          const { data: origMsg } = await supabase
            .from("whatsapp_messages")
            .select("lead_id")
            .eq("wuzapi_message_id", originalMsgId)
            .limit(1)
            .maybeSingle();
          if (origMsg) {
            reactionLeadId = origMsg.lead_id;
          } else {
            // Fallback: find lead by phone
            const cleanP = phone.replace(/^55/, "");
            const lastD = cleanP.slice(-8);
            const { data: lead } = await supabase
              .from("leads")
              .select("id")
              .or(`phone.eq.${phone},phone.eq.${cleanP},phone.like.%${lastD}%`)
              .limit(1)
              .maybeSingle();
            reactionLeadId = lead?.id || null;
          }

          const { error: reactErr } = await supabase.from("whatsapp_messages").insert({
            phone,
            content: emoji,
            direction: "inbound",
            message_type: "reaction",
            reaction_to_id: originalMsgId,
            status: "received",
            instance_id: instanceId,
            lead_id: reactionLeadId,
          });

          if (reactErr) {
            console.log("Reaction insert error:", reactErr.message);
          } else {
            console.log("✅ Reaction saved:", emoji, "→", originalMsgId, "lead:", reactionLeadId);
          }
        }
        return okResponse();
      }

      // ---- DETECT MEDIA TYPE ----
      const isImage = !!message.imageMessage;
      const isSticker = !!message.stickerMessage;
      const isAudio = !!message.audioMessage;
      const isVideo = !!message.videoMessage;
      const isDocument = !!message.documentMessage;
      const hasMedia = isImage || isSticker || isAudio || isVideo || isDocument;

      const content =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.documentMessage?.title ||
        message.videoMessage?.caption ||
        (isSticker ? "🏷️ Sticker" : null) ||
        (hasMedia ? "[Mídia recebida]" : "[sem conteúdo]");

      const messageType = (isImage || isSticker) ? "image"
        : isDocument ? "document"
        : isAudio ? "audio"
        : isVideo ? "video"
        : "text";

      // ---- DOWNLOAD MEDIA & UPLOAD TO STORAGE ----
      let mediaUrl: string | null = null;

      if (hasMedia && msgId && instanceId) {
        try {
          // Determine correct endpoint and extract media metadata
          const mediaMessage = isImage ? message.imageMessage
            : isSticker ? message.stickerMessage
            : isAudio ? message.audioMessage
            : isVideo ? message.videoMessage
            : message.documentMessage;

          console.log("mediaMessage fields:", JSON.stringify(mediaMessage));

          const endpointMap: Record<string, string> = {
            image: "/chat/downloadimage",
            audio: "/chat/downloadaudio",
            video: "/chat/downloadvideo",
            document: "/chat/downloaddocument",
            sticker: "/chat/downloadsticker",
          };
          const actualType = isSticker ? "sticker" : messageType;
          const endpoint = endpointMap[actualType] || "/chat/downloadimage";

          // Extract media fields from the payload
          const mediaFields = {
            Url: mediaMessage?.url || mediaMessage?.Url || "",
            MediaKey: mediaMessage?.mediaKey || mediaMessage?.MediaKey || "",
            Mimetype: mediaMessage?.mimetype || mediaMessage?.Mimetype || "application/octet-stream",
            FileSHA256: mediaMessage?.fileSha256 || mediaMessage?.FileSHA256 || "",
            FileEncSHA256: mediaMessage?.fileEncSha256 || mediaMessage?.FileEncSHA256 || "",
            FileLength: mediaMessage?.fileLength || mediaMessage?.FileLength || 0,
            DirectPath: mediaMessage?.directPath || mediaMessage?.DirectPath || "",
          };

      // ---- CHECK FOR EMBEDDED BASE64 MEDIA FIRST ----
          const embeddedBase64 = mediaMessage?.Data || mediaMessage?.Media
            || eventData?.Data || eventData?.Media || null;

          if (embeddedBase64 && typeof embeddedBase64 === "string" && embeddedBase64.length > 100) {
            console.log("Found embedded base64 media, length:", embeddedBase64.length, "first 30:", embeddedBase64.slice(0, 30));
            const mimetype = mediaFields.Mimetype;
            const ext = getExtFromMime(mimetype);
            const storagePath = `${instanceId}/${msgId}.${ext}`;

            const bytes = safeBase64Decode(embeddedBase64);
            if (bytes) {
              const { error: uploadErr } = await supabase.storage
                .from("whatsapp-media")
                .upload(storagePath, bytes, { contentType: mimetype, upsert: true });

              if (uploadErr) {
                console.log("Embedded media upload error:", uploadErr.message);
              } else {
                const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
                mediaUrl = urlData?.publicUrl || null;
                console.log("✅ Embedded media uploaded:", mediaUrl?.slice(0, 80));
              }
            } else {
              console.log("Failed to decode embedded base64");
            }
          } else if (instanceToken && WUZAPI_URL) {
            // ---- DOWNLOAD VIA WUZAPI ENDPOINT ----
            const fullUrl = `${WUZAPI_URL}${endpoint}`;
            console.log(`Downloading media via ${fullUrl}, msgId: ${msgId}, mime: ${mediaFields.Mimetype}`);

            const downloadResp = await fetch(fullUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "token": instanceToken,
              },
              body: JSON.stringify({
                MessageID: msgId,
                Url: mediaFields.Url,
                MediaKey: mediaFields.MediaKey,
                Mimetype: mediaFields.Mimetype,
                FileSHA256: mediaFields.FileSHA256,
                FileEncSHA256: mediaFields.FileEncSHA256,
                FileLength: mediaFields.FileLength,
                DirectPath: mediaFields.DirectPath,
              }),
            });

            if (downloadResp.ok) {
              const downloadData = await downloadResp.json();
              console.log("Download response keys:", Object.keys(downloadData?.data || downloadData || {}));
              const base64Media = downloadData?.data?.Data || downloadData?.data?.Media || downloadData?.Data || downloadData?.Media || null;
              const mimetype = downloadData?.data?.Mimetype || downloadData?.Mimetype || mediaFields.Mimetype;

              if (base64Media && typeof base64Media === "string") {
                console.log("base64Media length:", base64Media.length, "first 30:", base64Media.slice(0, 30));
                const ext = getExtFromMime(mimetype);
                const storagePath = `${instanceId}/${msgId}.${ext}`;

                const bytes = safeBase64Decode(base64Media);
                if (bytes && bytes.length > 0) {
                  const { error: uploadErr } = await supabase.storage
                    .from("whatsapp-media")
                    .upload(storagePath, bytes, { contentType: mimetype, upsert: true });

                  if (uploadErr) {
                    console.log("Storage upload error:", uploadErr.message);
                  } else {
                    const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
                    mediaUrl = urlData?.publicUrl || null;
                    console.log("✅ Media uploaded:", mediaUrl?.slice(0, 80));
                  }
                } else {
                  console.log("safeBase64Decode returned null/empty for WuzAPI response");
                }
              } else {
                console.log("No base64 media in download response, keys:", Object.keys(downloadData?.data || downloadData || {}));
              }
            } else {
              const errText = await downloadResp.text().catch(() => "");
              console.log(`Download media failed (${endpoint}):`, downloadResp.status, errText.slice(0, 200));
            }

            // ---- CDN FALLBACK (if WuzAPI download failed or returned no media) ----
            if (!mediaUrl) {
              const directUrl = mediaFields.Url || (mediaFields.DirectPath ? `https://mmg.whatsapp.net${mediaFields.DirectPath}` : "");
              // Only block .enc files (encrypted); allow images/videos that are often unencrypted
              const looksEncrypted = /\.enc(?:$|\?)/i.test(directUrl);

              if (directUrl && !looksEncrypted) {
                console.log("Trying direct CDN fetch:", directUrl.slice(0, 80));
                try {
                  const directResp = await fetch(directUrl);
                  if (directResp.ok) {
                    const blob = await directResp.arrayBuffer();
                    const bytes = new Uint8Array(blob);
                    // Validate: at least 1KB and doesn't look like encrypted binary
                    if (bytes.length > 1024) {
                      const ext = getExtFromMime(mediaFields.Mimetype);
                      const storagePath = `${instanceId}/${msgId}.${ext}`;
                      const { error: uploadErr } = await supabase.storage
                        .from("whatsapp-media")
                        .upload(storagePath, bytes, { contentType: mediaFields.Mimetype, upsert: true });
                      if (!uploadErr) {
                        const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
                        mediaUrl = urlData?.publicUrl || null;
                        console.log("✅ Media uploaded via direct CDN:", mediaUrl?.slice(0, 80));
                      } else {
                        console.log("Direct CDN upload error:", uploadErr.message);
                      }
                    } else {
                      console.log("CDN response too small, likely invalid:", bytes.length, "bytes");
                    }
                  } else {
                    console.log("Direct CDN fetch failed:", directResp.status);
                  }
                } catch (cdnErr) {
                  console.log("Direct CDN error:", cdnErr instanceof Error ? cdnErr.message : String(cdnErr));
                }
              } else if (directUrl) {
                console.log("Skipping encrypted CDN fallback:", directUrl.slice(0, 80));
              } else {
                console.log("No direct URL or DirectPath available for fallback");
              }
            }
          } else {
            console.log("No instanceToken or WUZAPI_URL, cannot download media");
          }
        } catch (dlErr) {
          console.log("Media download error:", dlErr instanceof Error ? dlErr.message : String(dlErr));
        }
      }

      // ---- FIND LEAD ----
      const cleanPhone = phone.replace(/^55/, "");
      const lastDigits = cleanPhone.slice(-8);
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.${cleanPhone},phone.like.%${lastDigits}%`)
        .limit(1)
        .maybeSingle();

      console.log("Lead match:", lead?.id || "none", "content:", content.slice(0, 60), "mediaUrl:", mediaUrl?.slice(0, 60) || "none");

      // Dedup: skip if this outbound echo already exists (sent from system)
      if (isFromMe && msgId) {
        const { data: existing } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("wuzapi_message_id", msgId)
          .limit(1)
          .maybeSingle();
        if (existing) {
          console.log("Skipping duplicate outbound echo:", msgId);
          return okResponse();
        }
      }

      const { error: insertErr } = await supabase.from("whatsapp_messages").insert({
        phone,
        content,
        lead_id: lead?.id || null,
        direction: isFromMe ? "outbound" : "inbound",
        message_type: messageType,
        media_url: mediaUrl,
        wuzapi_message_id: msgId || null,
        status: isFromMe ? "sent" : "received",
        instance_id: instanceId,
      });

      if (insertErr) {
        console.log("Insert error:", insertErr.message);
      } else {
        console.log(isFromMe ? "✅ Outbound echo saved" : "✅ Inbound message saved", "from:", phone);
      }

      return okResponse();
    }

    // ============ RECEIPT / READ RECEIPT EVENTS ============
    if (eventType === "ReadReceipt" || eventType === "Receipt") {
      const messageIds: string[] = eventData.MessageIDs || eventData.ids || (eventData.id ? [eventData.id] : []);
      const rawState = (body.state || eventData.Type || eventType).toLowerCase();
      const newStatus = (rawState === "read" || rawState === "played") ? "read" : "delivered";

      console.log("Receipt:", { messageIds, rawState, newStatus });

      let updated = 0;
      for (const msgId of messageIds) {
        if (!msgId) continue;
        const { data, error } = await supabase
          .from("whatsapp_messages")
          .update({ status: newStatus })
          .eq("wuzapi_message_id", msgId)
          .select("id");

        if (error) {
          console.log("Receipt update error for", msgId, error.message);
        } else if (data && data.length > 0) {
          updated++;
        }
      }

      console.log("✅ Receipt: updated", updated, "of", messageIds.length, "messages to", newStatus);
      return okResponse();
    }

    // ============ CHAT PRESENCE (typing) ============
    if (eventType === "ChatPresence") {
      const state = eventData.State || "";
      const presencePhone = extractPhone(eventData.Chat || eventData.JID || "");
      console.log("ChatPresence:", state, "phone:", presencePhone);

      if (presencePhone && (state === "composing" || state === "paused")) {
        const channel = supabase.channel("whatsapp-typing");
        await channel.send({
          type: "broadcast",
          event: "typing",
          payload: { phone: presencePhone, state, instanceId: instanceId || "" },
        });
        supabase.removeChannel(channel);
        console.log("✅ Broadcast typing:", state, presencePhone);
      }

      return okResponse();
    }

    // ============ CONNECTION STATUS ============
    if (eventType === "Connected" || eventType === "Disconnected" ||
        eventType === "LoggedOut" || eventType === "Ready") {
      const isConnected = eventType === "Connected" || eventType === "Ready";
      const newStatus = isConnected ? "connected" : "disconnected";
      console.log("Connection event:", eventType, "→", newStatus);

      if (instanceId) {
        await supabase.from("whatsapp_instances").update({
          status: newStatus,
          last_error: isConnected ? null : eventType,
          updated_at: new Date().toISOString(),
        }).eq("id", instanceId);
        console.log("✅ Instance", instanceId, "→", newStatus);
      }

      return okResponse();
    }

    console.log("Unhandled event type:", eventType);
    return okResponse();
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function safeBase64Decode(input: string): Uint8Array | null {
  try {
    // Remove data URI prefix and all whitespace/newlines
    const clean = input.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
    if (!clean || clean.length < 10) {
      console.log("safeBase64Decode: input too short after cleaning:", clean.length);
      return null;
    }
    const binaryStr = atob(clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.log("safeBase64Decode failed:", e instanceof Error ? e.message : String(e), "input length:", input.length, "first 40:", input.slice(0, 40));
    return null;
  }
}

function extractPhone(jidOrAlt: string): string {
  if (!jidOrAlt) return "";
  const cleaned = jidOrAlt.replace(/@.*$/, "").replace(/[.:].*$/, "");
  return /^\d{8,}$/.test(cleaned) ? cleaned : "";
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mime.toLowerCase()] || mime.split("/")[1]?.split(";")[0] || "bin";
}

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}
