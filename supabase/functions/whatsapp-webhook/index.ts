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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Raw type:", body.type, "instanceName:", body.instanceName, "userID:", body.userID, "state:", body.state);

    // ---- PARSE PAYLOAD ----
    // WuzAPI sends: { type: "Message"|"ReadReceipt"|"ChatPresence"|"Connected"|"Disconnected", event: {...data...}, instanceName, userID, state? }
    const eventType = typeof body.type === "string" ? body.type : (typeof body.event === "string" ? body.event : null);
    const eventData = (typeof body.event === "object" && body.event !== null) ? body.event : body.data || body;
    const instanceName = body.instanceName || "";
    const userID = body.userID || "";

    console.log("Parsed eventType:", eventType);

    // ---- RESOLVE INSTANCE ----
    const findInstanceId = async (): Promise<string | null> => {
      // Try by wuzapi_user_id
      if (userID) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id")
          .eq("wuzapi_user_id", userID)
          .limit(1)
          .maybeSingle();
        if (data) return data.id;
      }
      // Try by name
      if (instanceName) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id")
          .ilike("name", instanceName)
          .limit(1)
          .maybeSingle();
        if (data) return data.id;
      }
      // Fallback: first connected
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      return data?.id || null;
    };

    const instanceId = await findInstanceId();
    console.log("Resolved instanceId:", instanceId);

    // ============ MESSAGE EVENTS ============
    if (eventType === "Message") {
      const info = eventData.Info || {};
      const isFromMe = info.IsFromMe === true;
      const isGroup = info.IsGroup === true;

      // Skip group messages and self-sent echo
      if (isGroup) {
        console.log("Skipping group message");
        return okResponse();
      }

      // Extract phone from SenderAlt (has real phone) or Sender
      let phone = "";
      if (isFromMe) {
        // For outbound echo, get recipient from RecipientAlt or Chat
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

      // If IsFromMe, this is an echo of our sent message — skip saving (already saved on send)
      // But update the wuzapi_message_id if we can match it
      if (isFromMe) {
        console.log("IsFromMe echo, skipping inbound save");
        return okResponse();
      }

      // Extract message content
      const message = eventData.Message || eventData.RawMessage || {};
      const content =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.documentMessage?.title ||
        message.videoMessage?.caption ||
        "[Mídia recebida]";

      const messageType = message.imageMessage ? "image"
        : message.documentMessage ? "document"
        : message.audioMessage ? "audio"
        : message.videoMessage ? "video"
        : "text";

      // Extract media URL if available
      const mediaUrl =
        message.imageMessage?.url || message.imageMessage?.directPath ||
        message.audioMessage?.url || message.audioMessage?.directPath ||
        message.videoMessage?.url || message.videoMessage?.directPath ||
        message.documentMessage?.url || message.documentMessage?.directPath ||
        null;

      // Find lead by phone
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
      
      // state comes from body.state or eventData.Type
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
      // Not persisted — just log
      const state = eventData.State || "";
      console.log("ChatPresence:", state);
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
  // Remove @s.whatsapp.net, @lid, etc.
  const cleaned = jidOrAlt.replace(/@.*$/, "").replace(/[.:].*$/, "");
  // Only return if it looks like a phone number (digits only, 8+ chars)
  return /^\d{8,}$/.test(cleaned) ? cleaned : "";
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
