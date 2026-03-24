import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, isMetaConfigured, buildParamsArray, formatPhoneForWaba } from "../_shared/meta-whatsapp.ts";

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

    // Log start of execution
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

    // Check if function is paused
    const { data: pauseStatus } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "notify-party-hall-reminders")
      .single();

    if (pauseStatus?.paused) {
      console.log("Function is paused, skipping execution");
      if (logId) {
        await supabase.from("edge_function_logs").update({
          status: "skipped",
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result: { message: "Function is paused" },
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, message: "Function is paused" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate tomorrow's date (Brazil timezone UTC-3)
    const now = new Date();
    const brazilOffset = -3 * 60;
    const localNow = new Date(now.getTime() + (brazilOffset - now.getTimezoneOffset()) * 60 * 1000);
    const tomorrow = new Date(localNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`Checking for bookings on ${tomorrowStr}`);

    // Fetch confirmed bookings for tomorrow not yet notified
    const { data: bookings, error: bookingsError } = await supabase
      .from("party_hall_bookings")
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        condominium_id,
        resident:residents!inner(
          id,
          full_name,
          phone
        ),
        party_hall_setting:party_hall_settings!inner(
          name
        ),
        condominium:condominiums!inner(
          id,
          name
        )
      `)
      .eq("booking_date", tomorrowStr)
      .eq("status", "confirmada")
      .is("notification_sent_at", null);

    if (bookingsError) {
      throw new Error(`Error fetching bookings: ${bookingsError.message}`);
    }

    console.log(`Found ${bookings?.length || 0} bookings to notify`);

    if (!bookings || bookings.length === 0) {
      if (logId) {
        await supabase.from("edge_function_logs").update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result: { message: "No bookings to notify", date: tomorrowStr },
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, message: "No bookings to notify", date: tomorrowStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !whatsappConfig) {
      throw new Error("WhatsApp configuration not found or inactive");
    }

    const useOfficialApi = (whatsappConfig as any).use_official_api === true;
    const useWabaTemplates = (whatsappConfig as any).use_waba_templates === true;
    console.log(`[REMINDERS] use_official_api: ${useOfficialApi}, use_waba_templates: ${useWabaTemplates}`);

    // Get WABA template config
    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("content, waba_template_name, waba_language, params_order")
      .eq("slug", "party_hall_reminder")
      .eq("is_active", true)
      .maybeSingle();

    const wabaTemplateName = wabaTemplate?.waba_template_name || null;
    const wabaLanguage = wabaTemplate?.waba_language || "pt_BR";
    const paramsOrder = wabaTemplate?.params_order || [];
    const templateContent = wabaTemplate?.content || null;

    console.log(`[REMINDERS] WABA template: ${wabaTemplateName}, paramsOrder: ${JSON.stringify(paramsOrder)}`);

    // Check Meta is configured when using official API
    if (useOfficialApi && !isMetaConfigured()) {
      throw new Error("Meta WhatsApp API not configured (missing ACCESS_TOKEN or PHONE_ID)");
    }

    const results: { bookingId: string; success: boolean; error?: string }[] = [];

    for (const booking of bookings) {
      const resident = booking.resident as any;
      const condo = booking.condominium as any;
      const hallSetting = booking.party_hall_setting as any;

      if (!resident.phone) {
        console.log(`Skipping booking ${booking.id}: no phone number`);
        results.push({ bookingId: booking.id, success: false, error: "No phone number" });
        continue;
      }

      // Fetch checklist items
      const { data: checklistItems } = await supabase
        .from("party_hall_checklist_templates")
        .select("item_name, category")
        .eq("condominium_id", condo.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      // Format checklist
      let checklistText = "";
      const checklistLines: string[] = [];
      if (checklistItems && checklistItems.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const item of checklistItems) {
          const cat = item.category || "Geral";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item.item_name);
        }
        for (const [category, items] of Object.entries(grouped)) {
          checklistLines.push(`*${category}:*`);
          items.forEach(item => checklistLines.push(`  • ${item}`));
        }
        checklistText = `\n📋 *Itens Revisados:*\n${checklistLines.map(l => `📌 ${l}`).join("\n")}`;
      }

      // Format date
      const bookingDate = new Date(booking.booking_date + "T00:00:00");
      const formattedDate = bookingDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      let sendResult: { success: boolean; messageId?: string; error?: string };

      // Use WABA template if configured
      if (useOfficialApi && useWabaTemplates && wabaTemplateName && paramsOrder.length > 0) {
        console.log(`[REMINDERS] Sending WABA template "${wabaTemplateName}" for booking ${booking.id}`);

        // Build checklist as comma-separated for WABA
        const checklistString = checklistItems && checklistItems.length > 0
          ? sanitizeForWaba(checklistItems.map(i => i.item_name).join(", "))
          : "";

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
        console.log(`[REMINDERS] Body params: ${JSON.stringify(bodyParams)}`);

        sendResult = await sendMetaTemplate({
          phone: resident.phone,
          templateName: wabaTemplateName,
          language: wabaLanguage,
          bodyParams,
          bodyParamNames,
        });

        // Log to whatsapp_notification_logs
        await supabase.from("whatsapp_notification_logs").insert({
          function_name: "notify-party-hall-reminders",
          phone: resident.phone,
          template_name: wabaTemplateName,
          template_language: wabaLanguage,
          success: sendResult.success,
          message_id: sendResult.messageId || null,
          error_message: sendResult.error || null,
          request_payload: { paramsMap, bodyParams, bodyParamNames },
          response_status: sendResult.success ? 200 : 500,
          condominium_id: condo.id,
        });
      } else if (useOfficialApi) {
        // Direct text via Meta (requires 24h window - may fail)
        console.log(`[REMINDERS] Sending direct text via Meta for booking ${booking.id}`);
        
        let message: string;
        if (templateContent) {
          message = templateContent
            .replace("{condominio}", condo.name)
            .replace("{nome}", resident.full_name.split(" ")[0])
            .replace("{espaco}", hallSetting.name)
            .replace("{data}", formattedDate)
            .replace("{horario_inicio}", booking.start_time.slice(0, 5))
            .replace("{horario_fim}", booking.end_time.slice(0, 5))
            .replace("{checklist}", checklistText);
        } else {
          message = `🎉 LEMBRETE DE RESERVA - ${condo.name}\n\nOlá, ${resident.full_name.split(" ")[0]}!\n\nSua reserva do ${hallSetting.name} está confirmada para AMANHÃ:\nData: ${formattedDate}\nHorário: ${booking.start_time.slice(0, 5)} às ${booking.end_time.slice(0, 5)}${checklistText}\n\nBoa festa!`;
        }

        const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN")!;
        const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_ID")!;
        const formattedPhone = formatPhoneForWaba(resident.phone);

        try {
          const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: formattedPhone,
              type: "text",
              text: { body: message },
            }),
          });

          const responseData = await response.json();
          if (response.ok) {
            sendResult = { success: true, messageId: responseData?.messages?.[0]?.id };
          } else {
            sendResult = { success: false, error: responseData?.error?.message || "Erro Meta API" };
          }
        } catch (err: any) {
          sendResult = { success: false, error: err.message };
        }
      } else {
        // Legacy provider - skip if not configured
        console.log(`[REMINDERS] No official API configured, skipping booking ${booking.id}`);
        sendResult = { success: false, error: "Meta API não configurada para envio automático" };
      }

      if (sendResult.success) {
        await supabase
          .from("party_hall_bookings")
          .update({ notification_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
        console.log(`Notification sent for booking ${booking.id}`);
        results.push({ bookingId: booking.id, success: true });
      } else {
        console.error(`Error for booking ${booking.id}:`, sendResult.error);
        results.push({ bookingId: booking.id, success: false, error: sendResult.error });
      }

      // Rate limit delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    console.log(`Notifications completed: ${successCount} sent, ${failureCount} failed`);

    if (logId) {
      await supabase.from("edge_function_logs").update({
        status: failureCount > 0 && successCount === 0 ? "error" : "completed",
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        result: {
          date: tomorrowStr,
          total: bookings.length,
          sent: successCount,
          failed: failureCount,
          details: results,
        },
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: tomorrowStr,
        total: bookings.length,
        sent: successCount,
        failed: failureCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-party-hall-reminders:", error);

    if (logId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from("edge_function_logs").update({
        status: "error",
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error_message: error.message,
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
