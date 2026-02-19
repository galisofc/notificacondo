import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  sendMetaTemplate, 
  sendMetaImage, 
  formatPhoneForMeta, 
  buildParamsArray,
  isMetaConfigured,
  type MetaSendResult 
} from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize strings for use in messages
const sanitize = (str: string) => str.replace(/[<>"'`]/g, "").trim();

interface WhatsAppTemplateRow {
  id: string;
  slug: string;
  content: string;
  is_active: boolean;
  waba_template_name?: string;
  waba_language?: string;
  params_order?: string[];
}

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

    const { package_id, apartment_id, pickup_code, photo_url } = body;

    if (!package_id || !apartment_id || !pickup_code) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos: package_id, apartment_id e pickup_code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notifying package arrival: ${package_id} for apartment ${apartment_id}`);

    // ========== GENERATE SIGNED URL FOR PHOTO ==========
    // The package-photos bucket is private, so we need a signed URL for Meta to access
    let signedPhotoUrl: string | null = null;
    
    if (photo_url) {
      // Extract file path from the photo_url (remove bucket prefix if present)
      let filePath = photo_url;
      
      // Handle various URL formats
      if (photo_url.includes("/package-photos/")) {
        filePath = photo_url.split("/package-photos/").pop() || photo_url;
      } else if (photo_url.startsWith("http")) {
        // If it's already a full URL, extract just the filename
        const urlParts = photo_url.split("/");
        filePath = urlParts[urlParts.length - 1];
      }
      
      console.log(`Generating signed URL for photo: ${filePath}`);
      
      // Generate signed URL valid for 1 hour (enough time for Meta to download)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("package-photos")
        .createSignedUrl(filePath, 3600); // 1 hour expiration
      
      if (signedError) {
        console.error("Error generating signed URL:", signedError);
        // Continue without photo rather than failing the notification
      } else if (signedData?.signedUrl) {
        signedPhotoUrl = signedData.signedUrl;
        console.log(`Signed URL generated successfully`);
      }
    }

    // ========== AUTHORIZATION ==========
    const { data: apartment, error: aptError } = await supabase
      .from("apartments")
      .select(`
        id,
        number,
        blocks!inner (
          id,
          name,
          condominiums!inner (
            id,
            name,
            owner_id
          )
        )
      `)
      .eq("id", apartment_id)
      .single();

    if (aptError || !apartment) {
      console.error("Apartment not found:", aptError);
      return new Response(
        JSON.stringify({ error: "Apartamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blocks = apartment.blocks as any;
    const condoId = blocks.condominiums.id;
    const condoName = blocks.condominiums.name;
    const blockName = blocks.name;
    const aptNumber = apartment.number;

    // Check authorization (porteiro linked to condo, sindico owner, or super_admin)
    const { data: userCondoLink } = await supabase
      .from("user_condominiums")
      .select("id")
      .eq("user_id", user.id)
      .eq("condominium_id", condoId)
      .maybeSingle();

    const isOwner = blocks.condominiums.owner_id === user.id;
    
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!userCondoLink && !isOwner && !superAdminRole) {
      console.error(`User ${user.id} not authorized for condominium ${condoId}`);
      return new Response(
        JSON.stringify({ error: "Sem permissão para notificar neste condomínio" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH PACKAGE DETAILS ==========
    const { data: packageData, error: pkgError } = await supabase
      .from("packages")
      .select(`
        id,
        tracking_code,
        received_by,
        package_type_id,
        package_types (
          id,
          name
        )
      `)
      .eq("id", package_id)
      .single();

    if (pkgError) {
      console.error("Error fetching package:", pkgError);
    }

    const packageTypeName = (packageData?.package_types as any)?.name || "Não informado";
    const trackingCode = packageData?.tracking_code || "Não informado";

    // Fetch porter name who registered the package
    let porterName = "Portaria";
    if (packageData?.received_by) {
      const { data: porterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", packageData.received_by)
        .maybeSingle();
      
      if (porterProfile?.full_name) {
        porterName = porterProfile.full_name;
      }
    }

    console.log(`Package type: ${packageTypeName}, Tracking: ${trackingCode}, Porter: ${porterName}`);

    // ========== FETCH RESIDENTS ==========
    const { data: residents, error: resError } = await supabase
      .from("residents")
      .select("id, full_name, phone, email")
      .eq("apartment_id", apartment_id);

    if (resError) {
      console.error("Error fetching residents:", resError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar moradores" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!residents || residents.length === 0) {
      console.log("No residents found for apartment:", apartment_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum morador cadastrado para este apartamento",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter residents with phone numbers
    const residentsWithPhone = residents.filter(r => r.phone);
    
    if (residentsWithPhone.length === 0) {
      console.log("No residents with phone numbers found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum morador com telefone cadastrado",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH TEMPLATE ==========
    let wabaTemplateName: string | null = null;
    let wabaLanguage: string = "pt_BR";
    let paramsOrder: string[] = [];
    
    // Check for custom condominium template first
    const { data: customTemplate } = await supabase
      .from("condominium_whatsapp_templates")
      .select("content")
      .eq("condominium_id", condoId)
      .eq("template_slug", "package_arrival")
      .eq("is_active", true)
      .maybeSingle();

    // Fetch default template with WABA config
    const { data: defaultTemplate } = await supabase
      .from("whatsapp_templates")
      .select("id, slug, content, is_active, waba_template_name, waba_language, params_order")
      .eq("slug", "package_arrival")
      .eq("is_active", true)
      .maybeSingle() as { data: WhatsAppTemplateRow | null; error: any };

    if (defaultTemplate) {
      wabaTemplateName = defaultTemplate.waba_template_name || null;
      wabaLanguage = defaultTemplate.waba_language || "pt_BR";
      paramsOrder = defaultTemplate.params_order || [];
      console.log(`Template WABA config: name=${wabaTemplateName}, lang=${wabaLanguage}, params=${paramsOrder.join(",")}`);
    }

    // ========== SEND NOTIFICATIONS ==========
    const results: Array<{ resident_id: string; success: boolean; messageId?: string; error?: string }> = [];

    for (const resident of residentsWithPhone) {
      console.log(`Sending notification to ${resident.full_name} (${resident.phone})`);

      // Build variables for template
      const variables: Record<string, string> = {
        condominio: sanitize(condoName),
        nome: sanitize(resident.full_name || "Morador"),
        bloco: sanitize(blockName),
        apartamento: sanitize(aptNumber),
        tipo_encomenda: sanitize(packageTypeName),
        codigo_rastreio: sanitize(trackingCode),
        porteiro: sanitize(porterName),
        numeropedido: sanitize(pickup_code),
      };

      let result: MetaSendResult;

      // Try to send via WABA template if configured
      if (wabaTemplateName && paramsOrder.length > 0) {
        console.log(`Using WABA template: ${wabaTemplateName}`);
        
        const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, paramsOrder);
        
        result = await sendMetaTemplate({
          phone: resident.phone!,
          templateName: wabaTemplateName,
          language: wabaLanguage,
          bodyParams,
          bodyParamNames,
          headerMediaUrl: signedPhotoUrl || undefined,
          headerMediaType: signedPhotoUrl ? "image" : undefined,
        });
      } else {
        // Fallback: Send image with caption
        console.log("Fallback: sending image with caption");
        
        const caption = `🏢 *${sanitize(condoName)}*\n\n` +
          `📦 *Nova Encomenda!*\n\n` +
          `Olá, *${sanitize(resident.full_name || "Morador")}*!\n\n` +
          `Uma encomenda chegou para você:\n` +
          `• Tipo: ${sanitize(packageTypeName)}\n` +
          `• Bloco: ${sanitize(blockName)}\n` +
          `• Apto: ${sanitize(aptNumber)}\n` +
          `• Rastreio: ${sanitize(trackingCode)}\n` +
          `• Código de retirada: *${sanitize(pickup_code)}*\n\n` +
          `Recebido por: ${sanitize(porterName)}`;
        
        if (signedPhotoUrl) {
          result = await sendMetaImage({
            phone: resident.phone!,
            imageUrl: signedPhotoUrl,
            caption,
          });
        } else {
          // Import sendMetaText for text-only fallback
          const { sendMetaText } = await import("../_shared/meta-whatsapp.ts");
          result = await sendMetaText({
            phone: resident.phone!,
            message: caption,
          });
        }
      }

      // Log to whatsapp_notification_logs (with condominium_id for RLS)
      await supabase.from("whatsapp_notification_logs").insert({
        function_name: "notify-package-arrival",
        phone: resident.phone,
        resident_id: resident.id,
        package_id: package_id,
        condominium_id: condoId,
        template_name: wabaTemplateName || "package_arrival_fallback",
        template_language: wabaLanguage,
        success: result.success,
        message_id: result.messageId,
        error_message: result.error,
        request_payload: result.debug?.payload || { variables, params_order: paramsOrder },
        response_body: result.debug?.response,
        response_status: result.debug?.status,
        debug_info: { 
          original_photo_url: photo_url || null,
          signed_photo_url: signedPhotoUrl || null,
        },
      });

      results.push({
        resident_id: resident.id,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });

      // Small delay between messages to avoid rate limiting
      if (residentsWithPhone.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update package notification status
    const successCount = results.filter(r => r.success).length;

    // Fetch current notification_count to accumulate (not overwrite)
    const { data: currentPkg } = await supabase
      .from("packages")
      .select("notification_count")
      .eq("id", package_id)
      .single();

    const previousCount = currentPkg?.notification_count || 0;
    
    await supabase
      .from("packages")
      .update({
        notification_sent: successCount > 0,
        notification_sent_at: new Date().toISOString(),
        notification_count: previousCount + successCount,
      })
      .eq("id", package_id);

    // ========== UPDATE SUBSCRIPTION PACKAGE NOTIFICATION COUNTERS ==========
    if (successCount > 0) {
      // Fetch subscription for the condominium
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("id, package_notifications_limit, package_notifications_used, package_notifications_extra")
        .eq("condominium_id", condoId)
        .eq("active", true)
        .maybeSingle();

      if (subscription && !subError) {
        const isUnlimited = subscription.package_notifications_limit === -1;
        const currentUsed = subscription.package_notifications_used || 0;
        const currentExtra = subscription.package_notifications_extra || 0;
        const limit = subscription.package_notifications_limit || 0;

        // Check if over limit for each successful notification
        let newExtra = currentExtra;
        for (let i = 0; i < successCount; i++) {
          const usedAfterThis = currentUsed + i + 1;
          if (!isUnlimited && usedAfterThis > limit) {
            newExtra++;
          }
        }

        // Update subscription counters
        await supabase
          .from("subscriptions")
          .update({
            package_notifications_used: currentUsed + successCount,
            package_notifications_extra: newExtra,
          })
          .eq("id", subscription.id);

        console.log(`Updated subscription ${subscription.id}: used=${currentUsed + successCount}, extra=${newExtra}`);
      }
    }

    console.log(`Notification complete: ${successCount}/${results.length} sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notificação enviada para ${successCount} de ${results.length} moradores`,
        notifications_sent: successCount,
        total_residents: results.length,
        details: results,
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
