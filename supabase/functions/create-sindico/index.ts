import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CPF validation function
const isValidCPF = (cpf: string): boolean => {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
};

// Input validation schema
const CreateSindicoSchema = z.object({
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .toLowerCase(),
  password: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .max(72, "Senha muito longa"),
  full_name: z.string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(255, "Nome muito longo")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Nome contém caracteres inválidos"),
  phone: z.string()
    .max(20, "Telefone muito longo")
    .optional()
    .nullable(),
  cpf: z.string()
    .transform(val => val.replace(/\D/g, ""))
    .refine(val => val.length === 11, "CPF deve ter 11 dígitos")
    .refine(isValidCPF, "CPF inválido"),
  plan: z.enum(["start", "essencial", "profissional", "enterprise"]).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado. Apenas Super Admins podem criar síndicos." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Setting user context for audit:", requestingUser.id);

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = CreateSindicoSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation error:", parsed.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Dados inválidos", 
          details: parsed.error.errors.map(e => e.message) 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name, cpf, phone } = parsed.data;

    // Check if CPF already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "CPF já cadastrado no sistema. Verifique os dados informados." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user in auth.users
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createUserError) {
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao criar usuário: ${createUserError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    console.log("User created with ID:", userId);
    console.log("CPF to save:", cpf);

    // Wait a bit for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile (trigger already created it, so we update with additional info)
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        cpf,
        phone: phone || null,
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Try upsert as fallback
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          user_id: userId,
          email,
          full_name,
          cpf,
          phone: phone || null,
        }, { onConflict: 'user_id' });
      
      if (upsertError) {
        console.error("Profile upsert error:", upsertError);
      }
    } else {
      console.log("Profile updated successfully:", updatedProfile);
    }

    // Registrar log de auditoria manualmente com o ID do super admin que criou
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        table_name: "user_roles",
        action: "INSERT",
        record_id: userId,
        new_data: { 
          action: "create_sindico",
          created_user_id: userId,
          created_user_email: email,
          created_user_name: full_name
        },
        user_id: requestingUser.id
      });

    console.log("Audit log created with user_id:", requestingUser.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Síndico criado com sucesso",
        user_id: userId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Create sindico error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro interno do servidor",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
