import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  full_name: string;
  phone: string;
  email?: string;
  guardian_name?: string;
  source?: string;
  campaign?: string;
  ad_set?: string;
  ad_name?: string;
  external_id?: string;
  notes?: string;
  custom_fields?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept both GET and POST
    let payload: WebhookPayload;

    if (req.method === "GET") {
      const url = new URL(req.url);
      const params = url.searchParams;
      
      // Map query params to payload (supporting both naming conventions)
      payload = {
        full_name: params.get("client_name") || params.get("full_name") || "",
        phone: params.get("phone") || params.get("telefone") || "",
        email: params.get("email") || undefined,
        guardian_name: params.get("guardian_name") || undefined,
        source: params.get("source") || params.get("origem") || undefined,
        campaign: params.get("modelo") || params.get("campaign") || undefined,
        ad_set: params.get("projeto") || params.get("ad_set") || undefined,
        ad_name: params.get("ad_name") || undefined,
        external_id: params.get("lead_id") || params.get("external_id") || undefined,
        notes: buildNotesFromParams(params),
      };
    } else if (req.method === "POST") {
      const body = await req.json();
      
      // Map POST body to payload (supporting both naming conventions)
      payload = {
        full_name: body.client_name || body.full_name || "",
        phone: body.phone || body.telefone || "",
        email: body.email || undefined,
        guardian_name: body.guardian_name || undefined,
        source: body.source || body.origem || undefined,
        campaign: body.modelo || body.campaign || undefined,
        ad_set: body.projeto || body.ad_set || undefined,
        ad_name: body.ad_name || undefined,
        external_id: body.lead_id || body.external_id || undefined,
        notes: buildNotesFromBody(body),
        custom_fields: body.custom_fields || undefined,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received webhook payload:", payload);

    // Validate required fields
    if (!payload.full_name || !payload.phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: full_name/client_name and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove non-digits)
    const normalizedPhone = payload.phone.replace(/\D/g, "");

    // Check for duplicate by phone
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, full_name")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existingLead) {
      console.log("Duplicate lead found:", existingLead.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Lead already exists",
          lead_id: existingLead.id,
          duplicate: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find source by name or use "Outro" as fallback
    let sourceId = null;
    if (payload.source) {
      const { data: sourceData } = await supabase
        .from("lead_sources")
        .select("id")
        .ilike("name", payload.source)
        .maybeSingle();
      
      if (sourceData) {
        sourceId = sourceData.id;
      }
    }

    // If no source found, get "Outro" source
    if (!sourceId) {
      const { data: defaultSource } = await supabase
        .from("lead_sources")
        .select("id")
        .eq("name", "Outro")
        .maybeSingle();
      
      sourceId = defaultSource?.id;
    }

    // Insert new lead
    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        full_name: payload.full_name,
        phone: normalizedPhone,
        email: payload.email || null,
        guardian_name: payload.guardian_name || null,
        source_id: sourceId,
        campaign: payload.campaign || null,
        ad_set: payload.ad_set || null,
        ad_name: payload.ad_name || null,
        external_id: payload.external_id || null,
        external_source: "webhook",
        notes: payload.notes || null,
        status: "lead",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting lead:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Lead created successfully:", newLead.id);

    // Handle custom fields if provided
    if (payload.custom_fields && Object.keys(payload.custom_fields).length > 0) {
      // Get all active custom fields for leads
      const { data: customFields } = await supabase
        .from("custom_fields")
        .select("id, field_name, field_type")
        .eq("entity_type", "lead")
        .eq("is_active", true);

      if (customFields) {
        const customValuesToInsert = [];

        for (const [fieldName, value] of Object.entries(payload.custom_fields)) {
          const field = customFields.find(f => f.field_name === fieldName);
          if (field && value !== null && value !== undefined) {
            const customValue: Record<string, unknown> = {
              lead_id: newLead.id,
              field_id: field.id,
            };

            // Set the appropriate value column based on field type
            switch (field.field_type) {
              case "text":
              case "select":
                customValue.value_text = String(value);
                break;
              case "number":
                customValue.value_number = Number(value);
                break;
              case "date":
                customValue.value_date = value;
                break;
              case "boolean":
                customValue.value_boolean = Boolean(value);
                break;
            }

            customValuesToInsert.push(customValue);
          }
        }

        if (customValuesToInsert.length > 0) {
          const { error: customError } = await supabase
            .from("lead_custom_values")
            .insert(customValuesToInsert);

          if (customError) {
            console.error("Error inserting custom values:", customError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lead created successfully",
        lead_id: newLead.id
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to build notes from query params
function buildNotesFromParams(params: URLSearchParams): string {
  const parts: string[] = [];
  
  const telemarketing = params.get("Telemarketing") || params.get("telemarketing");
  const scouter = params.get("scouter") || params.get("Scouter");
  const local = params.get("local") || params.get("Local");
  const eventDate = params.get("event_date") || params.get("Data");
  const hora = params.get("Hora") || params.get("hora");
  
  if (telemarketing) parts.push(`Telemarketing: ${telemarketing}`);
  if (scouter) parts.push(`Scouter: ${scouter}`);
  if (local) parts.push(`Local: ${local}`);
  if (eventDate) parts.push(`Data Agendamento: ${eventDate}`);
  if (hora) parts.push(`Hora: ${hora}`);
  
  return parts.length > 0 ? parts.join(" | ") : "";
}

// Helper function to build notes from POST body
function buildNotesFromBody(body: Record<string, unknown>): string {
  const parts: string[] = [];
  
  const telemarketing = body.Telemarketing || body.telemarketing;
  const scouter = body.scouter || body.Scouter;
  const local = body.local || body.Local;
  const eventDate = body.event_date || body.Data;
  const hora = body.Hora || body.hora;
  
  if (telemarketing) parts.push(`Telemarketing: ${telemarketing}`);
  if (scouter) parts.push(`Scouter: ${scouter}`);
  if (local) parts.push(`Local: ${local}`);
  if (eventDate) parts.push(`Data Agendamento: ${eventDate}`);
  if (hora) parts.push(`Hora: ${hora}`);
  
  // Include any existing notes
  if (body.notes) parts.push(String(body.notes));
  
  return parts.length > 0 ? parts.join(" | ") : "";
}
