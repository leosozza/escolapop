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
  const WUZAPI_SECRET_KEY = Deno.env.get("WUZAPI_SECRET_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Event:", body.event, "Instance:", body.instance);
    console.log("Payload:", JSON.stringify(body).slice(0, 800));

    // Validate webhook secret if provided
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (WUZAPI_SECRET_KEY && webhookSecret && webhookSecret !== WUZAPI_SECRET_KEY) {
      console.log("Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = body.event || body.type;
    const instanceJid = body.instance || "";
    const instancePhone = instanceJid.replace(/@.*$/, "").replace(/[.:].*$/, "");

    console.log("Parsed event:", eventType, "instancePhone:", instancePhone);

    // Helper: find instance by JID/phone from the webhook payload
    const findInstanceId = async (): Promise<string | null> => {
      if (instancePhone) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id")
          .or(`phone_number.eq.${instancePhone},phone_number.like.%${instancePhone.slice(-8)}%`)
          .limit(1)
          .maybeSingle();
        if (data) return data.id;
      }

      // Fallback: first connected instance
      const { data: firstInstance } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      return firstInstance?.id || null;
    };

    // ============ MESSAGE EVENTS ============
    if (eventType === "Message") {
      const msgData = body.data || {};
      
      // WuzAPI format: data.sender contains the JID
      const sender = msgData.sender || msgData.Info?.Sender || msgData.Info?.MessageSource?.Sender || "";
      const phone = sender.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const pushName = msgData.pushName || msgData.Info?.PushName || "";

      console.log("Message from:", phone, "pushName:", pushName);

      if (!phone) {
        console.log("No phone found, skipping");
        return new Response(JSON.stringify({ ok: true, skipped: "no phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceId = await findInstanceId();
      console.log("Matched instance:", instanceId);

      // Extract message content — WuzAPI format
      // WuzAPI sends: data.message.conversation, data.message.extendedTextMessage.text, etc.
      const message = msgData.message || msgData.Message || {};
      const content =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.documentMessage?.title ||
        message.Conversation ||
        message.ExtendedTextMessage?.Text ||
        message.ImageMessage?.Caption ||
        message.DocumentMessage?.Title ||
        "[Mídia recebida]";

      const messageType = (message.imageMessage || message.ImageMessage)
        ? "image"
        : (message.documentMessage || message.DocumentMessage)
          ? "document"
          : (message.audioMessage || message.AudioMessage)
            ? "audio"
            : (message.videoMessage || message.VideoMessage)
              ? "video"
              : "text";

      // Find matching lead by phone
      const cleanPhone = phone.replace(/^55/, "");
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.${cleanPhone},phone.like.%${cleanPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();

      console.log("Lead match:", lead?.id || "none");

      const wuzapiMsgId = msgData.id || msgData.Info?.Id || null;

      await supabase.from("whatsapp_messages").insert({
        phone,
        content,
        lead_id: lead?.id || null,
        direction: "inbound",
        message_type: messageType,
        wuzapi_message_id: wuzapiMsgId,
        status: "received",
        instance_id: instanceId,
      });

      console.log("Message saved from:", phone, "content:", content.slice(0, 50));

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ RECEIPT EVENTS (delivery/read status) ============
    if (eventType === "Receipt" || eventType === "ReadReceipt") {
      const receiptData = body.data || {};
      console.log("Receipt data:", JSON.stringify(receiptData).slice(0, 500));

      // WuzAPI Receipt format: data.ids (array of message IDs), data.type ("delivered", "read", "played")
      const messageIds: string[] = receiptData.ids || (receiptData.id ? [receiptData.id] : []);
      const receiptType = receiptData.type || (eventType === "ReadReceipt" ? "read" : "delivered");
      
      const newStatus = (receiptType === "read" || receiptType === "played") ? "read" : "delivered";

      console.log("Updating", messageIds.length, "messages to status:", newStatus);

      for (const msgId of messageIds) {
        if (!msgId) continue;
        const { error } = await supabase
          .from("whatsapp_messages")
          .update({ status: newStatus })
          .eq("wuzapi_message_id", msgId);
        
        if (error) {
          console.log("Failed to update message", msgId, error.message);
        } else {
          console.log("Updated message", msgId, "→", newStatus);
        }
      }

      return new Response(JSON.stringify({ ok: true, updated: messageIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ STATUS EVENTS ============
    if (eventType === "Connected" || eventType === "Disconnected" ||
        eventType === "LoggedOut" || eventType === "Ready" ||
        eventType === "connected" || eventType === "disconnected") {

      const isConnected = eventType === "Connected" || eventType === "Ready" || eventType === "connected";
      const newStatus = isConnected ? "connected" : "disconnected";

      console.log("Status event:", eventType, "instance:", instancePhone, "→", newStatus);

      // Update matching instance
      if (instancePhone) {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("id")
          .or(`phone_number.eq.${instancePhone},phone_number.like.%${instancePhone.slice(-8)}%`)
          .limit(1)
          .maybeSingle();

        if (inst) {
          await supabase.from("whatsapp_instances").update({
            status: newStatus,
            last_error: isConnected ? null : eventType,
            phone_number: isConnected ? instancePhone : undefined,
            updated_at: new Date().toISOString(),
          }).eq("id", inst.id);
          console.log("Instance", inst.id, "updated to", newStatus);
        }
      }

      // Legacy whatsapp_session compatibility
      const { data: existing } = await supabase
        .from("whatsapp_session")
        .select("id")
        .limit(1)
        .maybeSingle();

      const sessionData = {
        status: newStatus,
        last_error: isConnected ? null : eventType,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("whatsapp_session").update(sessionData).eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_session").insert(sessionData);
      }
    }

    // ============ CHAT PRESENCE (typing) ============
    if (eventType === "ChatPresence") {
      console.log("ChatPresence:", JSON.stringify(body.data).slice(0, 200));
      // Not persisted — could be broadcast via Supabase Realtime channel in the future
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
