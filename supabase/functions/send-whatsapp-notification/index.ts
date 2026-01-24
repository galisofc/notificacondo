import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";
import { 
  sendMetaText, 
  isMetaConfigured,
  formatPhoneForMeta,
  type MetaSendResult 
} from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const SendNotificationSchema = z.object({
  occurrence_id: z.string().uuid("occurrence_id deve ser um UUID válido"),
  resident_id: z.string().uuid("resident_id deve ser um UUID válido"),
  message_template: z.string().max(2000, "Mensagem não pode exceder 2000 caracteres").optional(),
});

// Sanitize strings for use in messages
const sanitize = (str: string) => str.replace(/[<>"'`]/g, "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== CHECK META CONFIG ==========
    if (!isMetaConfigured()) {
      console.error("Meta WhatsApp not configured");
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp não configurado. Configure META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const parsed = SendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation error:", parsed.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados inválidos", 
          details: parsed.error.errors.map(e => e.message) 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { occurrence_id, resident_id, message_template } = parsed.data;

    // ========== AUTHORIZATION ==========
    const { data: occurrence, error: occCheckError } = await supabase
      .from("occurrences")
      .select("condominium_id")
      .eq("id", occurrence_id)
      .single();

    if (occCheckError || !occurrence) {
      console.error("Occurrence not found for auth check:", occCheckError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: condo } = await supabase
      .from("condominiums")
      .select("owner_id")
      .eq("id", occurrence.condominium_id)
      .single();

    if (!condo || condo.owner_id !== user.id) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        console.error(`User ${user.id} is not owner of condominium and not super_admin`);
        return new Response(
          JSON.stringify({ error: "Sem permissão para enviar notificações neste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Authorization passed for user ${user.id}`);

    // Get app URL from settings or use default
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_url")
      .maybeSingle();
    
    const appBaseUrl = (appSettings?.value as string) || "https://notificacondo.lovable.app";

    // Fetch resident and occurrence details
    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select(`
        id,
        full_name,
        phone,
        email,
        apartments!inner (
          number,
          blocks!inner (
            name,
            condominiums!inner (
              id,
              name
            )
          )
        )
      `)
      .eq("id", resident_id)
      .single();

    if (residentError || !resident) {
      console.error("Resident not found:", residentError);
      return new Response(
        JSON.stringify({ error: "Morador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resident.phone) {
      return new Response(
        JSON.stringify({ error: "Morador não possui telefone cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: occurrenceData, error: occError } = await supabase
      .from("occurrences")
      .select("id, title, type, status")
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrenceData) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token for the link
    const secureToken = crypto.randomUUID();
    const secureLink = `${appBaseUrl}/acesso/${secureToken}`;

    const apt = resident.apartments as any;
    const condoName = apt.blocks.condominiums.name;
    const condoId = apt.blocks.condominiums.id;

    // Type label mapping
    const typeLabels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };

    // Fetch template - first check for custom condominium template
    let templateContent: string | null = null;
    
    const { data: customTemplate } = await supabase
      .from("condominium_whatsapp_templates")
      .select("content")
      .eq("condominium_id", condoId)
      .eq("template_slug", "notification_occurrence")
      .eq("is_active", true)
      .maybeSingle();

    if (customTemplate?.content) {
      templateContent = customTemplate.content;
      console.log("Using custom condominium template");
    } else {
      // Fall back to default template
      const { data: defaultTemplate } = await supabase
        .from("whatsapp_templates")
        .select("content")
        .eq("slug", "notification_occurrence")
        .eq("is_active", true)
        .maybeSingle();
      
      if (defaultTemplate?.content) {
        templateContent = defaultTemplate.content;
        console.log("Using default system template");
      }
    }

    // Build message with sanitization
    const defaultMessage = `🏢 *${sanitize(condoName)}*

Olá, *${sanitize(resident.full_name)}*!

Você recebeu uma *${typeLabels[occurrenceData.type] || occurrenceData.type}*:
📋 *${sanitize(occurrenceData.title)}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 ${secureLink}

Este link é pessoal e intransferível.`;

    let message: string;
    if (message_template) {
      message = sanitize(message_template)
        .replace("{nome}", sanitize(resident.full_name))
        .replace("{tipo}", typeLabels[occurrenceData.type] || occurrenceData.type)
        .replace("{titulo}", sanitize(occurrenceData.title))
        .replace("{condominio}", sanitize(condoName))
        .replace("{link}", secureLink);
    } else if (templateContent) {
      message = templateContent
        .replace("{nome}", sanitize(resident.full_name))
        .replace("{tipo}", typeLabels[occurrenceData.type] || occurrenceData.type)
        .replace("{titulo}", sanitize(occurrenceData.title))
        .replace("{condominio}", sanitize(condoName))
        .replace("{link}", secureLink);
    } else {
      message = defaultMessage;
    }

    // Save notification record
    const { data: notification, error: notifError } = await supabase
      .from("notifications_sent")
      .insert({
        occurrence_id,
        resident_id,
        message_content: message,
        sent_via: "whatsapp_meta",
        secure_link: secureLink,
        secure_link_token: secureToken,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notifError) {
      console.error("Failed to save notification:", notifError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar notificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send WhatsApp message via Meta API
    console.log(`Sending WhatsApp message to: ${resident.phone}`);
    
    const result = await sendMetaText({
      phone: resident.phone,
      message,
      previewUrl: true,
    });

    // Update notification with result
    await supabase
      .from("notifications_sent")
      .update({
        zpro_message_id: result.messageId,
        zpro_status: result.success ? "sent" : "failed",
      })
      .eq("id", notification.id);

    if (!result.success) {
      console.error("WhatsApp send failed:", result.error);
      return new Response(
        JSON.stringify({ 
          error: "Falha ao enviar WhatsApp", 
          details: result.error,
          notification_id: notification.id 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp notification sent successfully:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notificação enviada com sucesso",
        notification_id: notification.id,
        message_id: result.messageId,
        secure_link: secureLink,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
