import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { porter_user_id, new_password, condominium_id, send_whatsapp } = body;

    if (!porter_user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "ID do porteiro e nova senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AUTHORIZATION ==========
    // Get porter's condominiums
    const { data: porterCondos, error: porterCondosError } = await supabase
      .from("user_condominiums")
      .select("condominium_id")
      .eq("user_id", porter_user_id);

    if (porterCondosError || !porterCondos?.length) {
      console.error("Porter condominiums not found:", porterCondosError);
      return new Response(
        JSON.stringify({ error: "Porteiro não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const porterCondoIds = porterCondos.map(c => c.condominium_id);

    // Check if user owns at least one of the porter's condominiums or is super_admin
    const { data: ownedCondos } = await supabase
      .from("condominiums")
      .select("id")
      .in("id", porterCondoIds)
      .eq("owner_id", user.id);

    let isAuthorized = (ownedCondos && ownedCondos.length > 0);

    if (!isAuthorized) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      isAuthorized = !!superAdminRole;
    }

    if (!isAuthorized) {
      console.error(`User ${user.id} is not authorized to update this porter's password`);
      return new Response(
        JSON.stringify({ error: "Sem permissão para alterar a senha deste porteiro" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authorization passed for user ${user.id}`);

    // ========== UPDATE PASSWORD IN AUTH ==========
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      porter_user_id,
      { password: new_password }
    );

    if (passwordError) {
      console.error("Error updating password:", passwordError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar senha" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password updated for porter ${porter_user_id}`);

    // ========== SEND WHATSAPP (optional) ==========
    let whatsapp_sent = false;

    if (send_whatsapp && condominium_id) {
      try {
        // Get porter profile and condominium info
        const { data: porterProfile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", porter_user_id)
          .single();

        const { data: condoData } = await supabase
          .from("condominiums")
          .select("name")
          .eq("id", condominium_id)
          .single();

        if (porterProfile?.phone && condoData) {
          // Get WhatsApp config
          const { data: whatsappConfig } = await supabase
            .from("whatsapp_config")
            .select("*")
            .eq("is_active", true)
            .single();

          // Get app_url from settings
          const { data: appSettings } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "app_url")
            .single();

          const appUrl = appSettings?.value || "https://notificacondo.lovable.app";

          if (whatsappConfig) {
            // Get template
            const { data: template } = await supabase
              .from("whatsapp_templates")
              .select("*")
              .eq("slug", "resend_porter_credentials")
              .eq("is_active", true)
              .single();

            if (template) {
              // Format phone
              const cleanPhone = porterProfile.phone.replace(/\D/g, "");
              const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

              // Check if using WABA templates
              if (whatsappConfig.use_waba_templates && template.waba_template_name) {
                // Send via WABA template
                const wabaTemplateUrl = `https://graph.facebook.com/v21.0/${Deno.env.get("META_WHATSAPP_PHONE_ID")}/messages`;
                
                const wabaPayload = {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: formattedPhone,
                  type: "template",
                  template: {
                    name: template.waba_template_name,
                    language: { code: template.waba_language || "pt_BR" },
                    components: [
                      {
                        type: "body",
                        parameters: (template.params_order || ["condominio", "nome", "email", "senha", "link"]).map((param: string) => {
                          const values: Record<string, string> = {
                            condominio: condoData.name,
                            nome: porterProfile.full_name,
                            email: porterProfile.email,
                            senha: new_password,
                            link: appUrl,
                          };
                          return { type: "text", text: values[param] || "" };
                        }),
                      },
                    ],
                  },
                };

                const wabaResponse = await fetch(wabaTemplateUrl, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${Deno.env.get("META_WHATSAPP_ACCESS_TOKEN")}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(wabaPayload),
                });

                if (wabaResponse.ok) {
                  whatsapp_sent = true;
                  console.log("WhatsApp WABA template sent successfully");
                } else {
                  const errorText = await wabaResponse.text();
                  console.error("WABA send error:", errorText);
                }
              } else {
                // Send via Z-API (non-WABA)
                let messageContent = template.content
                  .replace(/{condominio}/g, condoData.name)
                  .replace(/{nome}/g, porterProfile.full_name)
                  .replace(/{email}/g, porterProfile.email)
                  .replace(/{senha}/g, new_password)
                  .replace(/{link}/g, appUrl);

                const zapiUrl = `${whatsappConfig.api_url}/instances/${whatsappConfig.instance_id}/token/${whatsappConfig.api_key}/send-text`;

                const zapiResponse = await fetch(zapiUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    phone: formattedPhone,
                    message: messageContent,
                  }),
                });

                if (zapiResponse.ok) {
                  whatsapp_sent = true;
                  console.log("WhatsApp Z-API message sent successfully");
                } else {
                  const errorText = await zapiResponse.text();
                  console.error("Z-API send error:", errorText);
                }
              }
            }
          }
        }
      } catch (whatsappError) {
        console.error("Error sending WhatsApp:", whatsappError);
        // Don't fail the request, just log the error
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        whatsapp_sent,
        message: whatsapp_sent 
          ? "Senha atualizada e enviada por WhatsApp" 
          : "Senha atualizada com sucesso"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
