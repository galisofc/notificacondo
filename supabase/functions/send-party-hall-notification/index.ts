import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, isMetaConfigured, buildParamsArray, formatPhoneForMeta } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitizeForWaba = (text: string): string => {
  return text
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s{4,}/g, "   ")
    .replace(/\s+/g, " ")
    .trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check Meta config
    if (!isMetaConfigured()) {
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp não configurado. Configure META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { bookingId, notificationType = "reminder" } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "bookingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["reminder", "cancelled"];
    if (!validTypes.includes(notificationType)) {
      return new Response(
        JSON.stringify({ error: `Invalid notificationType. Valid types: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking with related data
    const { data: booking, error: bookingError } = await supabase
      .from("party_hall_bookings")
      .select(`
        id, booking_date, start_time, end_time, condominium_id,
        resident:residents!inner(id, full_name, phone, email),
        party_hall_setting:party_hall_settings!inner(name),
        condominium:condominiums!inner(id, name, owner_id)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const condo = booking.condominium as any;
    const resident = booking.resident as any;
    const hallSetting = booking.party_hall_setting as any;

    // Check authorization
    const isOwner = condo.owner_id === user.id;
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!isOwner && !roleCheck) {
      return new Response(
        JSON.stringify({ error: "Unauthorized to send notification for this booking" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resident.phone) {
      return new Response(
        JSON.stringify({ error: "Resident has no phone number registered" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template based on notification type
    const templateSlug = notificationType === "cancelled" ? "party_hall_cancelled" : "party_hall_reminder";

    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("content, waba_template_name, waba_language, params_order")
      .eq("slug", templateSlug)
      .eq("is_active", true)
      .maybeSingle();

    const wabaTemplateName = wabaTemplate?.waba_template_name || null;
    const wabaLanguage = wabaTemplate?.waba_language || "pt_BR";
    const paramsOrder = wabaTemplate?.params_order || [];

    if (!wabaTemplateName || paramsOrder.length === 0) {
      return new Response(
        JSON.stringify({ error: `Template WABA não vinculado para ${templateSlug}. Configure na aba Templates.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format date
    const bookingDate = new Date(booking.booking_date + "T00:00:00");
    const formattedDate = bookingDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Fetch checklist items for reminder
    let checklistString = "";
    if (notificationType === "reminder") {
      const { data: templateItems } = await supabase
        .from("party_hall_checklist_templates")
        .select("item_name")
        .eq("condominium_id", booking.condominium_id)
        .eq("is_active", true)
        .order("display_order");

      if (templateItems && templateItems.length > 0) {
        checklistString = sanitizeForWaba(templateItems.map(i => i.item_name).join(", "));
      }
    }

    // Build params map
    const paramsMap: Record<string, string> = {
      condominio: sanitizeForWaba(condo.name),
      nome: sanitizeForWaba(resident.full_name.split(" ")[0]),
      espaco: sanitizeForWaba(hallSetting.name),
      data: sanitizeForWaba(formattedDate),
      horario_inicio: booking.start_time.slice(0, 5),
      horario_fim: booking.end_time.slice(0, 5),
      checklist: checklistString,
    };

    const { values: bodyParams, names: bodyParamNames } = buildParamsArray(paramsMap, paramsOrder);

    console.log(`[PARTY-HALL] Sending WABA template "${wabaTemplateName}" to ${resident.phone}`);
    console.log(`[PARTY-HALL] Params: ${JSON.stringify(bodyParams)}`);

    const result = await sendMetaTemplate({
      phone: resident.phone,
      templateName: wabaTemplateName,
      language: wabaLanguage,
      bodyParams,
      bodyParamNames,
    });

    // Save to party_hall_notifications
    const messageContent = `${notificationType === "cancelled" ? "Cancelamento" : "Lembrete"} - ${hallSetting.name} - ${formattedDate}`;
    await supabase.from("party_hall_notifications").insert({
      booking_id: bookingId,
      condominium_id: booking.condominium_id,
      resident_id: resident.id,
      notification_type: notificationType,
      phone: resident.phone,
      message_content: messageContent,
      message_id: result.messageId || null,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
    });

    // Log to whatsapp_notification_logs
    await supabase.from("whatsapp_notification_logs").insert({
      function_name: "send-party-hall-notification",
      phone: resident.phone,
      template_name: wabaTemplateName,
      template_language: wabaLanguage,
      success: result.success,
      message_id: result.messageId || null,
      error_message: result.error || null,
      request_payload: result.debug?.payload || { paramsMap, bodyParams },
      response_status: result.debug?.status || null,
      response_body: typeof result.debug?.response === "string" ? result.debug.response.substring(0, 1000) : null,
      resident_id: resident.id,
      condominium_id: booking.condominium_id,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking notification timestamp for reminders
    if (notificationType === "reminder") {
      await supabase
        .from("party_hall_bookings")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", bookingId);
    }

    console.log(`Party hall ${notificationType} notification sent successfully`);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-party-hall-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
