import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, isMetaConfigured, buildParamsArray } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const triggerType = req.headers.get("x-trigger-type") || "manual";

  const { data: logEntry } = await supabase
    .from("edge_function_logs")
    .insert({
      function_name: "notify-trial-ending",
      trigger_type: triggerType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const logId = logEntry?.id;

  try {
    // Check pause
    const { data: pauseControl } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "notify-trial-ending")
      .maybeSingle();

    if (pauseControl?.paused) {
      if (logId) {
        await supabase.from("edge_function_logs").update({
          status: "skipped", ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result: { reason: "Function is paused" },
        }).eq("id", logId);
      }
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check Meta config
    if (!isMetaConfigured()) {
      throw new Error("Meta WhatsApp não configurado");
    }

    // Calculate dates
    const now = new Date();
    const oneDayFromNow = new Date(now); oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    const twoDaysFromNow = new Date(now); twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const oneDayStart = new Date(oneDayFromNow); oneDayStart.setHours(0, 0, 0, 0);
    const oneDayEnd = new Date(oneDayFromNow); oneDayEnd.setHours(23, 59, 59, 999);
    const twoDaysStart = new Date(twoDaysFromNow); twoDaysStart.setHours(0, 0, 0, 0);
    const twoDaysEnd = new Date(twoDaysFromNow); twoDaysEnd.setHours(23, 59, 59, 999);

    const { data: subs1 } = await supabase
      .from("subscriptions")
      .select("id, plan, trial_ends_at, condominium:condominiums!inner(id, name, owner_id)")
      .eq("is_trial", true).eq("active", true)
      .gte("trial_ends_at", oneDayStart.toISOString())
      .lte("trial_ends_at", oneDayEnd.toISOString());

    const { data: subs2 } = await supabase
      .from("subscriptions")
      .select("id, plan, trial_ends_at, condominium:condominiums!inner(id, name, owner_id)")
      .eq("is_trial", true).eq("active", true)
      .gte("trial_ends_at", twoDaysStart.toISOString())
      .lte("trial_ends_at", twoDaysEnd.toISOString());

    const allSubs = [
      ...(subs1 || []).map(s => ({ ...s, daysRemaining: 1 })),
      ...(subs2 || []).map(s => ({ ...s, daysRemaining: 2 })),
    ];

    if (allSubs.length === 0) {
      const result = { success: true, notified: 0 };
      if (logId) {
        await supabase.from("edge_function_logs").update({
          status: "success", ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime, result,
        }).eq("id", logId);
      }
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get WABA template
    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("waba_template_name, waba_language, params_order")
      .eq("slug", "trial_ending")
      .eq("is_active", true)
      .maybeSingle();

    // Get app URL
    const { data: whatsappConfig } = await supabase
      .from("whatsapp_config")
      .select("app_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const appBaseUrl = (whatsappConfig as any)?.app_url || "https://notificacondo.com.br";

    const results = { notified: 0, failed: 0, errors: [] as string[] };

    for (const sub of allSubs) {
      try {
        const condo = sub.condominium as any;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", condo.owner_id)
          .single();

        if (!profile?.phone) {
          results.errors.push(`${condo.name}: sem telefone`);
          results.failed++;
          continue;
        }

        const trialEndDate = new Date(sub.trial_ends_at!);
        const formattedDate = trialEndDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const daysLabel = sub.daysRemaining === 1 ? "1 dia" : `${sub.daysRemaining} dias`;

        if (wabaTemplate?.waba_template_name && wabaTemplate?.params_order?.length) {
          const variables: Record<string, string> = {
            condominio: condo.name,
            nome: profile.full_name,
            dias_restantes: daysLabel,
            data_expiracao: formattedDate,
            link_planos: `${appBaseUrl}/sindico/subscriptions`,
          };

          const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, wabaTemplate.params_order);

          const result = await sendMetaTemplate({
            phone: profile.phone,
            templateName: wabaTemplate.waba_template_name,
            language: wabaTemplate.waba_language || "pt_BR",
            bodyParams,
            bodyParamNames,
          });

          await supabase.from("whatsapp_notification_logs").insert({
            function_name: "notify-trial-ending",
            phone: profile.phone,
            template_name: wabaTemplate.waba_template_name,
            template_language: wabaTemplate.waba_language || "pt_BR",
            success: result.success,
            message_id: result.messageId || null,
            error_message: result.error || null,
            request_payload: { variables, bodyParams },
            response_status: result.debug?.status || null,
            condominium_id: condo.id,
          });

          if (result.success) {
            results.notified++;
          } else {
            results.errors.push(`${condo.name}: ${result.error}`);
            results.failed++;
          }
        } else {
          results.errors.push(`${condo.name}: Template WABA 'trial_ending' não configurado`);
          results.failed++;
        }
      } catch (err: any) {
        results.errors.push(`Sub ${sub.id}: ${err.message}`);
        results.failed++;
      }
    }

    const finalResult = { success: true, results };

    if (logId) {
      await supabase.from("edge_function_logs").update({
        status: "success", ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime, result: finalResult,
      }).eq("id", logId);
    }

    return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Unexpected error:", error);
    if (logId) {
      await supabase.from("edge_function_logs").update({
        status: "error", ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime, error_message: error.message,
      }).eq("id", logId);
    }
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
