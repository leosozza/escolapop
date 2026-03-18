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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // 1. Mark 24h alert: leads with first_contact > 24h ago and no first_response
    const { data: alertLeads, error: alertError } = await client
      .from("lead_response_tracking")
      .update({ alert_24h: true })
      .lt("first_contact_at", twentyFourHoursAgo)
      .is("first_response_at", null)
      .eq("alert_24h", false)
      .eq("auto_tabulated", false)
      .select("lead_id");

    if (alertError) console.error("Alert 24h error:", alertError);
    else console.log(`Marked ${alertLeads?.length || 0} leads with 24h alert`);

    // 2. Auto-tabulate 48h: leads with first_contact > 48h ago, no response, not yet tabulated
    const { data: autoTabLeads, error: tabError } = await client
      .from("lead_response_tracking")
      .update({ auto_tabulated: true })
      .lt("first_contact_at", fortyEightHoursAgo)
      .is("first_response_at", null)
      .eq("auto_tabulated", false)
      .select("lead_id");

    if (tabError) {
      console.error("Auto-tabulation error:", tabError);
    } else if (autoTabLeads && autoTabLeads.length > 0) {
      // Update the lead status to reflect non-enrollment
      for (const tracking of autoTabLeads) {
        await client
          .from("leads")
          .update({ status: "perdido" })
          .eq("id", tracking.lead_id);

        // Insert default non-enrollment reason
        await client.from("lead_non_enrollment_reasons").insert({
          lead_id: tracking.lead_id,
          reason: "sem_resposta",
        });
      }
      console.log(`Auto-tabulated ${autoTabLeads.length} leads as lead_nao_matriculado`);
    }

    // 3. Check enrolled students with 3+ absences -> mark as reprovado_faltas
    const { data: enrollments } = await client
      .from("enrollments")
      .select("id, lead_id, class_id, status")
      .eq("status", "em_curso")
      .not("class_id", "is", null);

    if (enrollments) {
      for (const enrollment of enrollments) {
        // Count total attendance records (at least 1 present)
        const { count: presentCount } = await client
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("student_id", enrollment.lead_id!)
          .eq("class_id", enrollment.class_id!)
          .eq("status", "presente");

        const { count: absenceCount } = await client
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("student_id", enrollment.lead_id!)
          .eq("class_id", enrollment.class_id!)
          .eq("status", "falta");

        if (absenceCount && absenceCount >= 3) {
          if (presentCount && presentCount > 0) {
            // Has attended at least once but 3+ absences -> reprovado_faltas
            await client
              .from("enrollments")
              .update({ status: "reprovado_faltas" as any })
              .eq("id", enrollment.id);
          } else {
            // Never attended -> ausente
            await client
              .from("enrollments")
              .update({ status: "ausente" as any })
              .eq("id", enrollment.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Automation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
