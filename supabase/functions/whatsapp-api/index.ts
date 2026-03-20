import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const WUZAPI_URL = Deno.env.get("WUZAPI_URL");
  const WUZAPI_ADMIN_TOKEN = Deno.env.get("WUZAPI_ADMIN_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!WUZAPI_URL || !WUZAPI_ADMIN_TOKEN) {
    return new Response(
      JSON.stringify({ error: "WuzAPI credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, ...params } = await req.json();

    // Helper to update session status in DB
    const updateSession = async (data: Record<string, unknown>) => {
      const { data: existing } = await supabase
        .from("whatsapp_session")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("whatsapp_session")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("whatsapp_session").insert(data);
      }
    };

    // Helper to call WuzAPI
    const wuzapiFetch = async (path: string, options: RequestInit = {}) => {
      const url = `${WUZAPI_URL}/api${path}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WUZAPI_ADMIN_TOKEN}`,
          ...(options.headers || {}),
        },
      });
      const text = await res.text();
      try {
        return { ok: res.ok, status: res.status, data: JSON.parse(text) };
      } catch {
        return { ok: res.ok, status: res.status, data: { raw: text } };
      }
    };

    // Auto-reconnect helper
    const ensureConnected = async (): Promise<boolean> => {
      const statusRes = await wuzapiFetch("/session/status", { method: "GET" });
      if (statusRes.ok && statusRes.data?.Connected) {
        await updateSession({ status: "connected", last_check_at: new Date().toISOString(), last_error: null });
        return true;
      }

      // Try to reconnect
      const connectRes = await wuzapiFetch("/session/connect", { method: "POST" });
      if (connectRes.ok) {
        await updateSession({ status: "connected", last_check_at: new Date().toISOString(), last_error: null });
        return true;
      }

      const errorMsg = connectRes.data?.message || "Failed to reconnect";
      await updateSession({ status: "disconnected", last_error: errorMsg, last_check_at: new Date().toISOString() });
      return false;
    };

    switch (action) {
      case "check-status": {
        const res = await wuzapiFetch("/session/status", { method: "GET" });
        const connected = res.ok && res.data?.Connected;
        await updateSession({
          status: connected ? "connected" : "disconnected",
          last_check_at: new Date().toISOString(),
          last_error: connected ? null : (res.data?.message || null),
        });
        return new Response(JSON.stringify({ connected, details: res.data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-qr": {
        const res = await wuzapiFetch("/session/qr", { method: "GET" });
        if (res.ok && res.data?.QRCode) {
          await updateSession({ qr_code: res.data.QRCode, status: "waiting_qr" });
        }
        return new Response(JSON.stringify(res.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect": {
        const res = await wuzapiFetch("/session/connect", { method: "POST" });
        if (res.ok) {
          await updateSession({ status: "connecting", last_error: null });
        }
        return new Response(JSON.stringify(res.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const res = await wuzapiFetch("/session/disconnect", { method: "POST" });
        await updateSession({ status: "disconnected" });
        return new Response(JSON.stringify(res.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-text": {
        const { phone, message, leadId } = params;
        if (!phone || !message) {
          return new Response(JSON.stringify({ error: "phone and message required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Ensure connected before sending
        const isConnected = await ensureConnected();
        if (!isConnected) {
          // Save failed message
          await supabase.from("whatsapp_messages").insert({
            phone,
            content: message,
            lead_id: leadId || null,
            direction: "outbound",
            status: "failed",
            error_message: "WhatsApp session disconnected",
          });
          return new Response(
            JSON.stringify({ error: "WhatsApp disconnected. Auto-reconnect failed." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const formattedPhone = phone.replace(/\D/g, "");
        const jid = formattedPhone.startsWith("55")
          ? `${formattedPhone}@s.whatsapp.net`
          : `55${formattedPhone}@s.whatsapp.net`;

        const res = await wuzapiFetch("/chat/send/text", {
          method: "POST",
          body: JSON.stringify({ Phone: jid, Body: message }),
        });

        const msgStatus = res.ok ? "sent" : "failed";
        const errorMsg = res.ok ? null : (res.data?.message || "Send failed");

        await supabase.from("whatsapp_messages").insert({
          phone: formattedPhone,
          content: message,
          lead_id: leadId || null,
          direction: "outbound",
          message_type: "text",
          status: msgStatus,
          error_message: errorMsg,
          wuzapi_message_id: res.data?.MessageID || null,
        });

        // Retry once on failure
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 5000));
          const retry = await wuzapiFetch("/chat/send/text", {
            method: "POST",
            body: JSON.stringify({ Phone: jid, Body: message }),
          });
          if (retry.ok) {
            await supabase
              .from("whatsapp_messages")
              .update({ status: "sent", error_message: null, wuzapi_message_id: retry.data?.MessageID })
              .eq("phone", formattedPhone)
              .eq("status", "failed")
              .order("created_at", { ascending: false })
              .limit(1);
          }
        }

        return new Response(JSON.stringify({ success: res.ok, data: res.data }), {
          status: res.ok ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-document": {
        const { phone, documentUrl, fileName, caption, leadId } = params;
        if (!phone || !documentUrl) {
          return new Response(JSON.stringify({ error: "phone and documentUrl required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isConnected = await ensureConnected();
        if (!isConnected) {
          return new Response(
            JSON.stringify({ error: "WhatsApp disconnected" }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const docPhone = phone.replace(/\D/g, "");
        const docJid = docPhone.startsWith("55")
          ? `${docPhone}@s.whatsapp.net`
          : `55${docPhone}@s.whatsapp.net`;

        const res = await wuzapiFetch("/chat/send/document", {
          method: "POST",
          body: JSON.stringify({
            Phone: docJid,
            Document: documentUrl,
            FileName: fileName || "document.pdf",
            Caption: caption || "",
          }),
        });

        await supabase.from("whatsapp_messages").insert({
          phone: docPhone,
          content: caption || fileName || "Documento",
          lead_id: leadId || null,
          direction: "outbound",
          message_type: "document",
          media_url: documentUrl,
          status: res.ok ? "sent" : "failed",
          error_message: res.ok ? null : (res.data?.message || "Send failed"),
        });

        return new Response(JSON.stringify({ success: res.ok, data: res.data }), {
          status: res.ok ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("WhatsApp API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
