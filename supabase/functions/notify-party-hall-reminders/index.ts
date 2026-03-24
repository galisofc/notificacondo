import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, isMetaConfigured, buildParamsArray } from "../_shared/meta-whatsapp.ts";

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

  const startTime = Date.now();
  let logId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: logEntry } = await supabase
      .from("edge_function_logs")
      .insert({
        function_name: "notify-party-hall-reminders",
        trigger_type: "cron",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    logId = logEntry?.id;

    // Check pause
    const { data: pauseStatus } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "notify-party-hall-reminders")
      .maybeSingle();

    if (pauseStatus?.paused) {
      if (logId) {
        await supabase.from("edge_function_logs").update({
          status: "skipped", ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result: { message: "Function is paused" },
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, message: "Function is paused" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Meta config
    if (!isMetaConfigured()) {
      throw new Error("Meta WhatsApp API not configured");
    }

    // Calculate tomorrow (Brazil UTC-3)
    const now = new Date();
    const brazilOffset = -3 * 60;
    const localNow = new Date(now.getTime() + (brazilOffset - now.getTimezoneOffset()) * 60 * 1000);
    const tomorrow = new Date(localNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`Checking for bookings on ${tomorrowStr}`);

    const { data: bookings, error: bookingsError } = await supabase
      .from("party_hall_bookings")
      .select(`
        id, booking_date, start_time, end_time, condominium_id,
        resident:residents!inner(id, full_name, phone),
        party_hall_setting:party_hall_settings!inner(name),
        condominium:condominiums!inner(id, name)
      `)
      .eq("booking_date", tomorrowStr)
      .eq("status", "confirmada")
      .is("notification_sent_at", null);

    if (bookingsError) throw new Error(`Error fetching bookings: ${bookingsError.message}`);

    if (!bookings || bookings.length === 0) {
      if (logId) {
        await supabase.from("edge_function_logs").update({
          status: "completed", ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result: { message: "No bookings to notify", date: tomorrowStr },
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, message: "No bookings to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WABA template
    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("waba_template_name, waba_language, params_order")
      .eq("slug", "party_hall_reminder")
      .eq("is_active", true)
      .maybeSingle();

    if (!wabaTemplate?.waba_template_name || !wabaTemplate?.params_order?.length) {
      throw new Error("Template WABA 'party_hall_reminder' não configurado");
    }

    const results: { bookingId: string; success: boolean; error?: string }[] = [];

    for (const booking of bookings) {
      const resident = booking.resident as any;
      const condo = booking.condominium as any;
      const hallSetting = booking.party_hall_setting as any;

      if (!resident.phone) {
        results.push({ bookingId: booking.id, success: false, error: "No phone" });
        continue;
      }

      // Fetch checklist items
      const { data: checklistItems } = await supabase
        .from("party_hall_checklist_templates")
        .select("item_name")
        .eq("condominium_id", condo.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      const checklistString = checklistItems && checklistItems.length > 0
        ? sanitizeForWaba(checklistItems.map(i => i.item_name).join(", "))
        : "";

      const bookingDate = new Date(booking.booking_date + "T00:00:00");
      const formattedDate = bookingDate.toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
      });

      const paramsMap: Record<string, string> = {
        condominio: sanitizeForWaba(condo.name),
        nome: sanitizeForWaba(resident.full_name.split(" ")[0]),
        espaco: sanitizeForWaba(hallSetting.name),
        data: sanitizeForWaba(formattedDate),
        horario_inicio: booking.start_time.slice(0, 5),
        horario_fim: booking.end_time.slice(0, 5),
        checklist: checklistString,
      };

      const { values: bodyParams, names: bodyParamNames } = buildParamsArray(paramsMap, wabaTemplate.params_order);

      const sendResult = await sendMetaTemplate({
        phone: resident.phone,
        templateName: wabaTemplate.waba_template_name,
        language: wabaTemplate.waba_language || "pt_BR",
        bodyParams,
        bodyParamNames,
      });

      await supabase.from("whatsapp_notification_logs").insert({
        function_name: "notify-party-hall-reminders",
        phone: resident.phone,
        template_name: wabaTemplate.waba_template_name,
        template_language: wabaTemplate.waba_language || "pt_BR",
        success: sendResult.success,
        message_id: sendResult.messageId || null,
        error_message: sendResult.error || null,
        request_payload: { paramsMap, bodyParams },
        response_status: sendResult.success ? 200 : 500,
        condominium_id: condo.id,
      });

      if (sendResult.success) {
        await supabase
          .from("party_hall_bookings")
          .update({ notification_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
        results.push({ bookingId: booking.id, success: true });
      } else {
        results.push({ bookingId: booking.id, success: false, error: sendResult.error });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    if (logId) {
      await supabase.from("edge_function_logs").update({
        status: failureCount > 0 && successCount === 0 ? "error" : "completed",
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        result: { date: tomorrowStr, total: bookings.length, sent: successCount, failed: failureCount, details: results },
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, date: tomorrowStr, sent: successCount, failed: failureCount, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    if (logId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("edge_function_logs").update({
        status: "error", ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime, error_message: error.message,
      }).eq("id", logId);
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
