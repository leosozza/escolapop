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
  const WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "";

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

      if (isFromMe) {
        console.log("IsFromMe echo, skipping inbound save");
        return okResponse();
      }

      const message = eventData.Message || eventData.RawMessage || {};

      // ---- HANDLE REACTIONS ----
      if (message.reactionMessage) {
        const reaction = message.reactionMessage;
        const emoji = reaction.text || "";
        const originalMsgId = reaction.key?.id || "";

        console.log("Reaction:", { emoji, originalMsgId, phone });

        if (emoji && originalMsgId) {
          const { error: reactErr } = await supabase.from("whatsapp_messages").insert({
            phone,
            content: emoji,
            direction: "inbound",
            message_type: "reaction",
            reaction_to_id: originalMsgId,
            status: "received",
            instance_id: instanceId,
          });

          if (reactErr) {
            console.log("Reaction insert error:", reactErr.message);
          } else {
            console.log("✅ Reaction saved:", emoji, "→", originalMsgId);
          }
        }
        return okResponse();
      }

      // ---- DETECT MEDIA TYPE ----
      const isImage = !!message.imageMessage;
      const isAudio = !!message.audioMessage;
      const isVideo = !!message.videoMessage;
      const isDocument = !!message.documentMessage;
      const hasMedia = isImage || isAudio || isVideo || isDocument;

      const content =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.documentMessage?.title ||
        message.videoMessage?.caption ||
        (hasMedia ? "[Mídia recebida]" : "[sem conteúdo]");

      const messageType = isImage ? "image"
        : isDocument ? "document"
        : isAudio ? "audio"
        : isVideo ? "video"
        : "text";

      // ---- DOWNLOAD MEDIA & UPLOAD TO STORAGE ----
      let mediaUrl: string | null = null;

      if (hasMedia && msgId && instanceToken && WUZAPI_URL) {
        try {
          console.log("Downloading media for msgId:", msgId);
          const downloadResp = await fetch(`${WUZAPI_URL}/chat/downloadmedia`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instanceToken,
            },
            body: JSON.stringify({ MessageID: msgId }),
          });

          if (downloadResp.ok) {
            const downloadData = await downloadResp.json();
            const base64Media = downloadData?.data?.Media || downloadData?.Media || null;
            const mimetype = downloadData?.data?.Mimetype || downloadData?.Mimetype || "application/octet-stream";

            if (base64Media) {
              const ext = getExtFromMime(mimetype);
              const storagePath = `${instanceId || "unknown"}/${msgId}.${ext}`;

              // Decode base64 to Uint8Array
              const binaryStr = atob(base64Media);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }

              const { error: uploadErr } = await supabase.storage
                .from("whatsapp-media")
                .upload(storagePath, bytes, {
                  contentType: mimetype,
                  upsert: true,
                });

              if (uploadErr) {
                console.log("Storage upload error:", uploadErr.message);
              } else {
                const { data: urlData } = supabase.storage
                  .from("whatsapp-media")
                  .getPublicUrl(storagePath);
                mediaUrl = urlData?.publicUrl || null;
                console.log("✅ Media uploaded:", mediaUrl?.slice(0, 80));
              }
            } else {
              console.log("No base64 media in download response");
            }
          } else {
            console.log("Download media failed:", downloadResp.status, await downloadResp.text().catch(() => ""));
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

      const { error: insertErr } = await supabase.from("whatsapp_messages").insert({
        phone,
        content,
        lead_id: lead?.id || null,
        direction: "inbound",
        message_type: messageType,
        media_url: mediaUrl,
        wuzapi_message_id: msgId || null,
        status: "received",
        instance_id: instanceId,
      });

      if (insertErr) {
        console.log("Insert error:", insertErr.message);
      } else {
        console.log("✅ Inbound message saved from:", phone);
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
