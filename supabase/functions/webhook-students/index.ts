import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Field aliases mapping
const FIELD_ALIASES: Record<string, string[]> = {
  full_name: ["client_name", "nome", "name", "full_name", "nome_completo"],
  phone: ["telefone", "celular", "whatsapp", "phone", "fone"],
  email: ["e-mail", "email"],
  age: ["idade", "student_age", "age"],
  course: ["curso", "course_name", "course"],
  class_name: ["turma", "class", "class_name"],
  enrollment_type: ["tipo_matricula", "tipo", "enrollment_type", "type"],
  referral_code: ["codigo_agente", "agent_code", "referral_code", "codigo"],
  influencer: ["influenciador", "influencer_name", "influencer"],
  notes: ["observacoes", "observações", "notes", "obs"],
};

// Enrollment type normalization
const ENROLLMENT_TYPE_MAP: Record<string, string> = {
  maxfama: "modelo_agenciado_maxfama",
  "max fama": "modelo_agenciado_maxfama",
  "pop school": "modelo_agenciado_popschool",
  popschool: "modelo_agenciado_popschool",
  "indicação influência": "indicacao_influencia",
  "indicacao influencia": "indicacao_influencia",
  influencia: "indicacao_influencia",
  "indicação aluno": "indicacao_aluno",
  "indicacao aluno": "indicacao_aluno",
  aluno: "indicacao_aluno",
};

function getValue(params: Record<string, string>, field: string): string | null {
  // Check the field itself first
  if (params[field]) return params[field];
  
  // Check aliases
  const aliases = FIELD_ALIASES[field] || [];
  for (const alias of aliases) {
    if (params[alias]) return params[alias];
    // Also check lowercase version
    const lowerAlias = alias.toLowerCase();
    if (params[lowerAlias]) return params[lowerAlias];
  }
  
  return null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeEnrollmentType(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  return ENROLLMENT_TYPE_MAP[normalized] || null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let params: Record<string, string> = {};

    // Parse parameters based on method
    if (req.method === "GET") {
      const url = new URL(req.url);
      url.searchParams.forEach((value, key) => {
        params[key.toLowerCase()] = value;
      });
    } else if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const body = await req.json();
        // Flatten and lowercase keys
        Object.entries(body).forEach(([key, value]) => {
          if (typeof value === "string" || typeof value === "number") {
            params[key.toLowerCase()] = String(value);
          }
        });
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        formData.forEach((value, key) => {
          params[key.toLowerCase()] = String(value);
        });
      }
    }

    console.log("Received params:", params);

    // Extract and validate required fields
    const fullName = getValue(params, "full_name");
    const phoneRaw = getValue(params, "phone");

    if (!fullName || !phoneRaw) {
      console.error("Missing required fields:", { fullName, phoneRaw });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nome e telefone são obrigatórios",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const phone = normalizePhone(phoneRaw);
    
    if (phone.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Telefone inválido (mínimo 10 dígitos)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract optional fields
    const email = getValue(params, "email");
    const ageRaw = getValue(params, "age");
    const age = ageRaw ? parseInt(ageRaw, 10) : null;
    const courseName = getValue(params, "course");
    const className = getValue(params, "class_name");
    const enrollmentTypeRaw = getValue(params, "enrollment_type");
    const enrollmentType = normalizeEnrollmentType(enrollmentTypeRaw);
    const referralCode = getValue(params, "referral_code");
    const influencer = getValue(params, "influencer");
    const notes = getValue(params, "notes");

    console.log("Parsed values:", {
      fullName,
      phone,
      email,
      age,
      courseName,
      className,
      enrollmentType,
      referralCode,
      influencer,
    });

    // Check for existing lead by phone
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let leadId: string;

    if (existingLead) {
      leadId = existingLead.id;
      console.log("Using existing lead:", leadId);
    } else {
      // Create new lead with status 'matriculado'
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          full_name: fullName,
          phone: phone,
          email: email,
          status: "matriculado",
          notes: notes,
          external_source: "webhook",
        })
        .select("id")
        .single();

      if (leadError) {
        console.error("Error creating lead:", leadError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro ao criar lead: ${leadError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      leadId = newLead.id;
      console.log("Created new lead:", leadId);
    }

    // Find course by name
    let courseId: string | null = null;
    if (courseName) {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, name")
        .eq("is_active", true);

      const matchedCourse = courses?.find(
        (c) =>
          c.name.toLowerCase().includes(courseName.toLowerCase()) ||
          courseName.toLowerCase().includes(c.name.toLowerCase())
      );

      if (matchedCourse) {
        courseId = matchedCourse.id;
      }
    }

    // If no course found by name, get the first active course
    if (!courseId) {
      const { data: defaultCourse } = await supabase
        .from("courses")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (defaultCourse) {
        courseId = defaultCourse.id;
      }
    }

    if (!courseId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nenhum curso ativo encontrado",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find class by name if provided
    let classId: string | null = null;
    if (className) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, course_id")
        .eq("is_active", true)
        .eq("course_id", courseId);

      const matchedClass = classes?.find(
        (c) =>
          c.name.toLowerCase().includes(className.toLowerCase()) ||
          className.toLowerCase().includes(c.name.toLowerCase())
      );

      if (matchedClass) {
        classId = matchedClass.id;
      }
    }

    // Create enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .insert({
        lead_id: leadId,
        course_id: courseId,
        class_id: classId,
        status: "ativo",
        student_age: age && !isNaN(age) ? age : null,
        enrollment_type: enrollmentType,
        referral_agent_code: referralCode,
        influencer_name: influencer,
        notes: notes,
      })
      .select("id")
      .single();

    if (enrollmentError) {
      console.error("Error creating enrollment:", enrollmentError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao criar matrícula: ${enrollmentError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Created enrollment:", enrollment.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Matrícula criada com sucesso",
        data: {
          lead_id: leadId,
          enrollment_id: enrollment.id,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno do servidor",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
