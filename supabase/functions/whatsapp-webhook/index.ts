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

    // Validate webhook secret if provided
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (WUZAPI_SECRET_KEY && webhookSecret && webhookSecret !== WUZAPI_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = body.event || body.type;

    // Helper: find instance by JID or token in the payload
    const findInstanceId = async (): Promise<string | null> => {
      // WuzAPI may include the instance JID in the payload
      const jid = body.Info?.Sender || body.instance || body.jid || "";
      const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");

      if (phone) {
        // Try to find instance by phone_number
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id")
          .or(`phone_number.eq.${phone},phone_number.like.%${phone.slice(-8)}%`)
          .limit(1)
          .maybeSingle();
        if (data) return data.id;
      }

      // Fallback: use the first active instance
      const { data: firstInstance } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      return firstInstance?.id || null;
    };

    if (eventType === "message" || body.Info?.MessageSource) {
      const message = body.Message || body;
      const sender = body.Info?.Sender || body.sender || "";
      const phone = sender.replace("@s.whatsapp.net", "").replace("@g.us", "");

      if (!phone) {
        return new Response(JSON.stringify({ ok: true, skipped: "no phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceId = await findInstanceId();

      // Find matching lead
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
        instance_id: instanceId,
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Session status events — update instance status
    if (eventType === "disconnected" || eventType === "LoggedOut" ||
        eventType === "connected" || eventType === "Ready") {

      const isConnected = eventType === "connected" || eventType === "Ready";
      const newStatus = isConnected ? "connected" : "disconnected";

      // Try to identify which instance this event belongs to
      const jid = body.jid || body.JID || "";
      const instancePhone = jid.replace("@s.whatsapp.net", "");

      // Update matching instance or fallback to all
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

      // Also update legacy whatsapp_session for backward compatibility
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
