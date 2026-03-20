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
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    // Validate webhook secret if provided
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (WUZAPI_SECRET_KEY && webhookSecret && webhookSecret !== WUZAPI_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = body.event || body.type;
    const instanceJid = body.instance || "";
    const instancePhone = instanceJid.replace(/@s\.whatsapp\.net$/, "").replace(/\..*$/, "");

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
      const sender = msgData.sender || msgData.Info?.Sender || "";
      const phone = sender.replace("@s.whatsapp.net", "").replace("@g.us", "");

      if (!phone) {
        return new Response(JSON.stringify({ ok: true, skipped: "no phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceId = await findInstanceId();

      // Extract message content — WuzAPI format
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
            : "text";

      // Find matching lead by phone
      const cleanPhone = phone.replace(/^55/, "");
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.${cleanPhone},phone.like.%${cleanPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();

      await supabase.from("whatsapp_messages").insert({
        phone,
        content,
        lead_id: lead?.id || null,
        direction: "inbound",
        message_type: messageType,
        wuzapi_message_id: msgData.id || msgData.Info?.Id || null,
        status: "received",
        instance_id: instanceId,
      });

      console.log("Message saved from:", phone, "content:", content.slice(0, 50));

      return new Response(JSON.stringify({ ok: true }), {
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

    // ============ READ RECEIPT ============
    if (eventType === "ReadReceipt") {
      console.log("Read receipt received");
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
