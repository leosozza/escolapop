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

    // Validate webhook secret if provided in header
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (WUZAPI_SECRET_KEY && webhookSecret && webhookSecret !== WUZAPI_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WuzAPI sends different event types
    const eventType = body.event || body.type;

    if (eventType === "message" || body.Info?.MessageSource) {
      // Incoming message
      const message = body.Message || body;
      const sender = body.Info?.Sender || body.sender || "";
      
      // Extract phone from JID (format: 5511999999999@s.whatsapp.net)
      const phone = sender.replace("@s.whatsapp.net", "").replace("@g.us", "");

      if (!phone) {
        return new Response(JSON.stringify({ ok: true, skipped: "no phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to find matching lead by phone
      const cleanPhone = phone.replace(/^55/, "");
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.${cleanPhone},phone.like.%${cleanPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();

      const content =
        message.Conversation ||
        message.ExtendedTextMessage?.Text ||
        message.ImageMessage?.Caption ||
        message.DocumentMessage?.Title ||
        "[Mídia recebida]";

      const messageType = message.ImageMessage
        ? "image"
        : message.DocumentMessage
          ? "document"
          : message.AudioMessage
            ? "audio"
            : "text";

      await supabase.from("whatsapp_messages").insert({
        phone,
        content,
        lead_id: lead?.id || null,
        direction: "inbound",
        message_type: messageType,
        wuzapi_message_id: body.Info?.Id || null,
        status: "received",
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Session status events
    if (eventType === "disconnected" || eventType === "LoggedOut") {
      const { data: existing } = await supabase
        .from("whatsapp_session")
        .select("id")
        .limit(1)
        .maybeSingle();

      const sessionData = {
        status: "disconnected",
        last_error: eventType,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("whatsapp_session").update(sessionData).eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_session").insert(sessionData);
      }
    }

    if (eventType === "connected" || eventType === "Ready") {
      const { data: existing } = await supabase
        .from("whatsapp_session")
        .select("id")
        .limit(1)
        .maybeSingle();

      const sessionData = {
        status: "connected",
        last_error: null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("whatsapp_session").update(sessionData).eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_session").insert(sessionData);
      }
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
