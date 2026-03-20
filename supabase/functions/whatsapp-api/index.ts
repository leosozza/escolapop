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
  const WUZAPI_BASE_URL = WUZAPI_URL.replace(/\/+$/, "");

  const buildWuzapiUrl = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${WUZAPI_BASE_URL}${normalizedPath}`;
  };

  const normalizeRemotePhone = (jid?: string | null) => {
    if (!jid) return null;
    return jid.replace(/@.*$/, "").replace(/[.:].*$/, "");
  };

  const normalizeName = (value?: string | null) => (value || "").trim().toLowerCase();

  const matchRemoteUser = (
    users: Array<Record<string, unknown>>,
    name?: string | null,
    token?: string | null,
    userId?: string | null,
  ) => {
    const normalizedName = normalizeName(name);

    const byUserId = userId
      ? users.find(
          (user) =>
            String(user.id || "") === String(userId) &&
            (!normalizedName || normalizeName(String(user.name || "")) === normalizedName),
        )
      : null;

    const byToken = token
      ? users.find((user) => String(user.token || "") === String(token))
      : null;

    const nameMatches = normalizedName
      ? users.filter((user) => normalizeName(String(user.name || "")) === normalizedName)
      : [];

    const byUniqueName = nameMatches.length === 1 ? nameMatches[0] : null;

    return byToken || byUserId || byUniqueName || null;
  };

  const extractCreatedUser = (
    payload: any,
    name?: string | null,
    token?: string | null,
    userId?: string | null,
  ) => {
    const rawData = payload?.data;

    if (Array.isArray(rawData)) {
      return matchRemoteUser(rawData, name, token, userId);
    }

    if (rawData && typeof rawData === "object") {
      return rawData;
    }

    return null;
  };

  // Helper: call WuzAPI with admin token
  const adminFetch = async (path: string, options: RequestInit = {}) => {
    const url = buildWuzapiUrl(path);
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: WUZAPI_ADMIN_TOKEN,
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

  // Helper: call WuzAPI with instance token
  const instanceFetch = async (token: string, path: string, options: RequestInit = {}) => {
    const url = buildWuzapiUrl(path);
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        token: token,
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

  // Helper: get instance record from DB
  const getInstanceRecord = async (instanceId: string) => {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id, name, phone_number, wuzapi_token, wuzapi_user_id")
      .eq("id", instanceId)
      .single();
    return data;
  };

  // Helper: update instance in DB
  const updateInstance = async (instanceId: string, data: Record<string, unknown>) => {
    await supabase
      .from("whatsapp_instances")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", instanceId);
  };

  const createRemoteUser = async (name: string, existingToken?: string | null) => {
    const requestedToken = existingToken || crypto.randomUUID().replace(/-/g, "");

    console.log("Creating WuzAPI user:", name, "with token:", requestedToken.slice(0, 8));
    const createRes = await adminFetch("/admin/users", {
      method: "POST",
      body: JSON.stringify({ name, token: requestedToken }),
    });

    console.log("WuzAPI create response:", JSON.stringify(createRes.data).slice(0, 500));

    if (!createRes.ok) {
      return { error: createRes.data, user: null, token: null as string | null };
    }

    const createdUserFromResponse = extractCreatedUser(createRes.data, name, requestedToken, null);
    let remoteUser: Record<string, unknown> | null = null;

    const listRes = await adminFetch("/admin/users", { method: "GET" });
    if (listRes.ok && Array.isArray(listRes.data?.data)) {
      remoteUser = listRes.data.data.find(
        (user: Record<string, unknown>) => String(user.token || "") === requestedToken,
      ) || null;
    }

    if (!remoteUser?.id && createdUserFromResponse?.id) {
      remoteUser = createdUserFromResponse;
    }

    return {
      error: null,
      token: String(remoteUser?.token || requestedToken),
      user: remoteUser
        ? {
            id: String(remoteUser.id || ""),
            name: String(remoteUser.name || name),
            token: String(remoteUser.token || requestedToken),
            phone_number: normalizeRemotePhone(String(remoteUser.jid || "")),
          }
        : null,
    };
  };

  const resolveInstanceAuth = async (instanceId: string) => {
    const instance = await getInstanceRecord(instanceId);
    if (!instance) return null;

    const listRes = await adminFetch("/admin/users", { method: "GET" });

    if (listRes.ok && Array.isArray(listRes.data?.data)) {
      const remoteUsers = listRes.data.data as Array<Record<string, unknown>>;
      const remoteUser = matchRemoteUser(
        remoteUsers,
        instance.name,
        instance.wuzapi_token,
        instance.wuzapi_user_id,
      );

      if (remoteUser) {
        const nextToken = String(remoteUser.token || instance.wuzapi_token || "");
        const nextUserId = String(remoteUser.id || instance.wuzapi_user_id || "");
        const nextPhone = normalizeRemotePhone(String(remoteUser.jid || ""));

        if (
          nextToken !== String(instance.wuzapi_token || "") ||
          nextUserId !== String(instance.wuzapi_user_id || "") ||
          nextPhone !== (instance.phone_number || null)
        ) {
          await updateInstance(instanceId, {
            wuzapi_token: nextToken || null,
            wuzapi_user_id: nextUserId || null,
            phone_number: nextPhone,
            last_error: null,
          });
        }

        return {
          ...instance,
          wuzapi_token: nextToken || null,
          wuzapi_user_id: nextUserId || null,
          phone_number: nextPhone,
        };
      }
    }

    const created = await createRemoteUser(instance.name, instance.wuzapi_token);

    if (!created.user?.id || !created.token) {
      return instance;
    }

    await updateInstance(instanceId, {
      wuzapi_user_id: created.user.id,
      wuzapi_token: created.user.token,
      phone_number: created.user.phone_number,
      last_error: null,
    });

    return {
      ...instance,
      wuzapi_user_id: created.user.id,
      wuzapi_token: created.user.token,
      phone_number: created.user.phone_number,
    };
  };

  // Helper: auto-reconnect for an instance
  const ensureConnected = async (instanceId: string, token: string): Promise<boolean> => {
    const statusRes = await instanceFetch(token, "/session/status", { method: "GET" });
    if (statusRes.ok && statusRes.data?.data?.Connected) {
      await updateInstance(instanceId, { status: "connected", last_error: null, last_check_at: new Date().toISOString() });
      return true;
    }

    const connectRes = await instanceFetch(token, "/session/connect", {
      method: "POST",
      body: JSON.stringify({ Subscribe: ["Message", "ReadReceipt", "Connected", "Disconnected"], Immediate: true }),
    });
    if (connectRes.ok) {
      await updateInstance(instanceId, { status: "connecting", last_error: null, last_check_at: new Date().toISOString() });
      return true;
    }

    const errorMsg = connectRes.data?.message || "Failed to reconnect";
    await updateInstance(instanceId, { status: "disconnected", last_error: errorMsg, last_check_at: new Date().toISOString() });
    return false;
  };

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { action, instanceId, ...params } = await req.json();

    switch (action) {
      // ============ ADMIN: Instance Management ============

      case "create-instance": {
        const { name, connectionType } = params;
        if (!name) return json({ error: "name is required" }, 400);

        const created = await createRemoteUser(name);

        if (!created.user?.id || !created.token) {
          return json({ error: "Failed to create WuzAPI user", details: created.error || "Invalid WuzAPI response" }, 500);
        }

        console.log("Parsed user:", { token: created.token.slice(0, 8), userId: created.user.id });

        // Save instance to DB
        const { data: instance, error: insertError } = await supabase
          .from("whatsapp_instances")
          .insert({
            name,
            wuzapi_user_id: created.user.id,
            wuzapi_token: created.user.token,
            connection_type: connectionType || "qrcode",
            status: "disconnected",
            phone_number: created.user.phone_number,
          })
          .select("id")
          .single();

        if (insertError) {
          return json({ error: "Failed to save instance", details: insertError.message }, 500);
        }

        // Auto-configure webhook using the instance token
        if (created.user.token) {
          const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
          const whRes = await instanceFetch(created.user.token, "/webhook", {
            method: "POST",
            body: JSON.stringify({
              webhook: webhookUrl,
              events: ["Message", "ReadReceipt", "Connected", "Disconnected"],
            }),
          });
          console.log("Webhook config response:", JSON.stringify(whRes.data).slice(0, 200));
        }

        return json({ success: true, instance: { id: instance.id, name } });
      }

      case "delete-instance": {
        if (!instanceId) return json({ error: "instanceId required" }, 400);

        const inst = await resolveInstanceAuth(instanceId);
        if (inst?.wuzapi_user_id) {
          // Try to disconnect first
          if (inst.wuzapi_token) {
            await instanceFetch(inst.wuzapi_token, "/session/logout", { method: "POST" }).catch(() => {});
          }
          // Delete from WuzAPI
          await adminFetch(`/admin/users/${inst.wuzapi_user_id}/full`, { method: "DELETE" }).catch(() => {});
        }

        await supabase.from("whatsapp_instances").delete().eq("id", instanceId);
        return json({ success: true });
      }

      case "list-instances": {
        const res = await adminFetch("/admin/users", { method: "GET" });
        return json({ success: true, data: res.data });
      }

      // ============ Per-Instance Actions ============

      case "check-status": {
        if (!instanceId) return json({ error: "instanceId required" }, 400);
        const inst = await resolveInstanceAuth(instanceId);
        if (!inst?.wuzapi_token) return json({ error: "Instance not found" }, 404);

        console.log("check-status token:", inst.wuzapi_token.slice(0, 8), "user:", inst.wuzapi_user_id);
        const res = await instanceFetch(inst.wuzapi_token, "/session/status", { method: "GET" });
        console.log("check-status response:", JSON.stringify(res.data).slice(0, 300));
        
        const connected = res.ok && res.data?.data?.Connected;
        await updateInstance(instanceId, {
          status: connected ? "connected" : "disconnected",
          last_check_at: new Date().toISOString(),
          last_error: connected ? null : (res.data?.error || res.data?.data?.message || null),
        });
        return json({ connected, details: res.data });
      }

      case "get-qr": {
        if (!instanceId) return json({ error: "instanceId required" }, 400);
        const inst = await resolveInstanceAuth(instanceId);
        if (!inst?.wuzapi_token) return json({ error: "Instance not found" }, 404);

        console.log("get-qr token:", inst.wuzapi_token.slice(0, 8));
        const res = await instanceFetch(inst.wuzapi_token, "/session/qr", { method: "GET" });
        console.log("get-qr response status:", res.status, "has QR:", !!res.data?.data?.QRCode);
        
        if (res.ok && res.data?.data?.QRCode) {
          await updateInstance(instanceId, { qr_code: res.data.data.QRCode, status: "waiting_qr" });
        }
        return json(res.data?.data || res.data);
      }

      case "connect": {
        if (!instanceId) return json({ error: "instanceId required" }, 400);
        const inst = await resolveInstanceAuth(instanceId);
        if (!inst?.wuzapi_token) return json({ error: "Instance not found" }, 404);

        console.log("connect token:", inst.wuzapi_token.slice(0, 8), "user:", inst.wuzapi_user_id);
        const res = await instanceFetch(inst.wuzapi_token, "/session/connect", {
          method: "POST",
          body: JSON.stringify({ Subscribe: ["Message", "ReadReceipt", "Connected", "Disconnected"], Immediate: true }),
        });
        console.log("connect response:", JSON.stringify(res.data).slice(0, 300));

        if (res.ok) {
          await updateInstance(instanceId, { status: "connecting", last_error: null });

          // Auto-configure webhook on connect
          const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
          await instanceFetch(inst.wuzapi_token, "/webhook", {
            method: "POST",
            body: JSON.stringify({
              webhook: webhookUrl,
              events: ["Message", "ReadReceipt", "Connected", "Disconnected"],
            }),
          });
        } else {
          await updateInstance(instanceId, { 
            status: "disconnected", 
            last_error: res.data?.error || res.data?.raw || "Falha ao conectar" 
          });
        }
        return json(res.data);
      }

      case "disconnect": {
        if (!instanceId) return json({ error: "instanceId required" }, 400);
        const inst = await resolveInstanceAuth(instanceId);
        if (!inst?.wuzapi_token) return json({ error: "Instance not found" }, 404);

        await instanceFetch(inst.wuzapi_token, "/session/disconnect", { method: "POST" });
        await updateInstance(instanceId, { status: "disconnected" });
        return json({ success: true });
      }

      case "send-text": {
        const { phone, message, leadId } = params;
        if (!instanceId || !phone || !message) {
          return json({ error: "instanceId, phone and message required" }, 400);
        }

        const inst = await resolveInstanceAuth(instanceId);
        if (!inst?.wuzapi_token) return json({ error: "Instance not found" }, 404);

        // Ensure connected before sending
        const isConnected = await ensureConnected(instanceId, inst.wuzapi_token);
        if (!isConnected) {
          await supabase.from("whatsapp_messages").insert({
            phone, content: message, lead_id: leadId || null,
            direction: "outbound", status: "failed",
            error_message: "WhatsApp session disconnected",
            instance_id: instanceId,
          });
          return json({ error: "WhatsApp disconnected. Auto-reconnect failed." }, 503);
        }

        const formattedPhone = phone.replace(/\D/g, "");
        const phoneNumber = formattedPhone.startsWith("55")
          ? formattedPhone
          : `55${formattedPhone}`;

        const res = await instanceFetch(inst.wuzapi_token, "/chat/send/text", {
          method: "POST",
          body: JSON.stringify({ Phone: phoneNumber, Body: message }),
        });

        const msgStatus = res.ok ? "sent" : "failed";
        const errorMsg = res.ok ? null : (res.data?.message || "Send failed");

        await supabase.from("whatsapp_messages").insert({
          phone: formattedPhone, content: message, lead_id: leadId || null,
          direction: "outbound", message_type: "text",
          status: msgStatus, error_message: errorMsg,
          wuzapi_message_id: res.data?.data?.MessageID || res.data?.MessageID || null,
          instance_id: instanceId,
        });

        // Retry once on failure
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 3000));
          const retry = await instanceFetch(inst.wuzapi_token, "/chat/send/text", {
            method: "POST",
            body: JSON.stringify({ Phone: phoneNumber, Body: message }),
          });
          if (retry.ok) {
            await supabase
              .from("whatsapp_messages")
              .update({ status: "sent", error_message: null })
              .eq("instance_id", instanceId)
              .eq("phone", formattedPhone)
              .eq("status", "failed")
              .order("created_at", { ascending: false })
              .limit(1);
          }
        }

        return json({ success: res.ok, data: res.data }, res.ok ? 200 : 500);
      }

      case "send-document": {
        const { phone, documentUrl, fileName, caption, leadId } = params;
        if (!instanceId || !phone || !documentUrl) {
          return json({ error: "instanceId, phone and documentUrl required" }, 400);
        }

        const inst = await resolveInstanceAuth(instanceId);
        if (!inst?.wuzapi_token) return json({ error: "Instance not found" }, 404);

        const isConnected = await ensureConnected(instanceId, inst.wuzapi_token);
        if (!isConnected) return json({ error: "WhatsApp disconnected" }, 503);

        const docPhone = phone.replace(/\D/g, "");
        const docPhoneNumber = docPhone.startsWith("55")
          ? docPhone
          : `55${docPhone}`;

        const res = await instanceFetch(inst.wuzapi_token, "/chat/send/document", {
          method: "POST",
          body: JSON.stringify({
            Phone: docPhoneNumber, Document: documentUrl,
            FileName: fileName || "document.pdf", Caption: caption || "",
          }),
        });

        await supabase.from("whatsapp_messages").insert({
          phone: docPhone, content: caption || fileName || "Documento",
          lead_id: leadId || null, direction: "outbound",
          message_type: "document", media_url: documentUrl,
          status: res.ok ? "sent" : "failed",
          error_message: res.ok ? null : (res.data?.message || "Send failed"),
          instance_id: instanceId,
        });

        return json({ success: res.ok, data: res.data }, res.ok ? 200 : 500);
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("WhatsApp API error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
