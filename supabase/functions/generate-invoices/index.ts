import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Subscription {
  id: string;
  condominium_id: string;
  plan: string;
  active: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  is_trial: boolean;
  trial_ends_at: string | null;
}

const PLAN_PRICES: Record<string, number> = {
  start: 0,
  essencial: 49.90,
  profissional: 99.90,
  enterprise: 199.90,
};

// Multi-provider WhatsApp configuration
type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderConfig {
  sendMessage: (phone: string, message: string, config: ProviderSettings) => Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface ProviderSettings {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

interface WhatsAppConfigRow {
  id: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
  app_url?: string;
}

// Z-PRO Provider
const zproProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const baseUrl = config.apiUrl.replace(/\/$/, "");
    const phoneClean = phone.replace(/\D/g, "");
    
    const params = new URLSearchParams({
      body: message,
      number: phoneClean,
      externalKey: config.apiKey,
      bearertoken: config.apiKey,
      isClosed: "false"
    });
    
    const sendUrl = `${baseUrl}/params/?${params.toString()}`;
    console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
    
    try {
      const response = await fetch(sendUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const responseText = await response.text();
      console.log("Z-PRO response status:", response.status);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, error: `Resposta inválida: ${responseText.substring(0, 100)}` };
      }
      
      if (response.ok) {
        const extractedMessageId = data.id || data.messageId || data.key?.id || data.msgId || data.message_id;
        if (extractedMessageId && extractedMessageId !== "sent") {
          return { success: true, messageId: String(extractedMessageId) };
        }
        return { success: true, messageId: `zpro_${Date.now()}` };
      }
      
      return { success: false, error: data.message || data.error || `Erro ${response.status}` };
    } catch (error: any) {
      return { success: false, error: `Erro de conexão: ${error.message}` };
    }
  },
};

// Z-API Provider
const zapiProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const response = await fetch(`${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
      }),
    });
    
    const data = await response.json();
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

// Evolution API Provider
const evolutionProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        text: message,
      }),
    });
    
    const data = await response.json();
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

// WPPConnect Provider
const wppconnectProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const response = await fetch(`${config.apiUrl}/api/${config.instanceId}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
        isGroup: false,
      }),
    });
    
    const data = await response.json();
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

const providers: Record<WhatsAppProvider, ProviderConfig> = {
  zpro: zproProvider,
  zapi: zapiProvider,
  evolution: evolutionProvider,
  wppconnect: wppconnectProvider,
};

// Function to send invoice notification to síndico
async function sendInvoiceNotification(
  supabase: any,
  condominiumId: string,
  invoiceNumber: string,
  periodStart: string,
  periodEnd: string,
  amount: number,
  dueDate: string,
  appBaseUrl: string,
  whatsappConfig: WhatsAppConfigRow
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get condominium and owner details
    const { data: condominium, error: condoError } = await supabase
      .from("condominiums")
      .select("id, name, owner_id")
      .eq("id", condominiumId)
      .single();

    if (condoError || !condominium) {
      console.error("Error fetching condominium:", condoError);
      return { success: false, error: "Condomínio não encontrado" };
    }

    // Get owner profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", condominium.owner_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return { success: false, error: "Perfil do síndico não encontrado" };
    }

    if (!profile.phone) {
      console.log(`Síndico ${profile.full_name} não possui telefone cadastrado. Pulando notificação.`);
      return { success: false, error: "Síndico sem telefone cadastrado" };
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("slug", "invoice_generated")
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error("Template invoice_generated not found:", templateError);
      return { success: false, error: "Template de notificação não encontrado" };
    }

    // Format dates
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    const dueDateObj = new Date(dueDate);
    
    const formatDate = (date: Date) => date.toLocaleDateString("pt-BR");
    const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Build message
    const message = template.content
      .replace("{condominio}", condominium.name)
      .replace("{nome}", profile.full_name)
      .replace("{numero_fatura}", invoiceNumber || "N/A")
      .replace("{periodo}", `${formatDate(periodStartDate)} a ${formatDate(periodEndDate)}`)
      .replace("{valor}", formatCurrency(amount))
      .replace("{data_vencimento}", formatDate(dueDateObj))
      .replace("{link}", `${appBaseUrl}/sindico/invoices`);

    // Send WhatsApp message
    const provider = providers[whatsappConfig.provider as WhatsAppProvider];
    if (!provider) {
      console.error(`Provider ${whatsappConfig.provider} not found`);
      return { success: false, error: `Provider ${whatsappConfig.provider} não suportado` };
    }

    console.log(`Sending invoice notification to ${profile.full_name} (${profile.phone})`);
    
    const result = await provider.sendMessage(profile.phone, message, {
      apiUrl: whatsappConfig.api_url,
      apiKey: whatsappConfig.api_key,
      instanceId: whatsappConfig.instance_id,
    });

    if (result.success) {
      console.log(`Invoice notification sent successfully to ${profile.full_name}`);
    } else {
      console.error(`Failed to send invoice notification: ${result.error}`);
    }

    return result;
  } catch (error: any) {
    console.error("Error sending invoice notification:", error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Determine trigger type from request header or default to manual
  const triggerType = req.headers.get("x-trigger-type") || "manual";

  // Fetch WhatsApp config for notifications
  const { data: whatsappConfig } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appBaseUrl = whatsappConfig?.app_url || "https://notificacondo.com.br";

  // Create execution log entry
  const { data: logEntry } = await supabase
    .from("edge_function_logs")
    .insert({
      function_name: "generate-invoices",
      trigger_type: triggerType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const logId = logEntry?.id;

  try {
    console.log("Starting invoice generation process...");

    // Check if this function is paused
    const { data: pauseControl } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "generate-invoices")
      .maybeSingle();

    if (pauseControl?.paused) {
      console.log("Function generate-invoices is PAUSED. Skipping execution.");
      
      // Update log as skipped
      if (logId) {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "skipped",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            result: { reason: "Function is paused via admin panel" },
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: "Function is paused via admin panel" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Fetch all active subscriptions that need invoice generation
    const { data: subscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, condominium_id, plan, active, current_period_start, current_period_end, is_trial, trial_ends_at")
      .eq("active", true);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} total active subscriptions to evaluate`);

    const results = {
      processed: 0,
      invoicesCreated: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      trialsEnded: 0,
      errors: [] as string[],
    };

    for (const subscription of subscriptions || []) {
      try {
        const price = PLAN_PRICES[subscription.plan] || 0;

        // Check if subscription is still in trial period
        if (subscription.is_trial && subscription.trial_ends_at) {
          const trialEnd = new Date(subscription.trial_ends_at);
          const todayDate = new Date(today);

          // If trial hasn't ended yet, skip this subscription
          if (todayDate < trialEnd) {
            console.log(`Subscription ${subscription.id} is still in trial period (ends ${subscription.trial_ends_at}). Skipping.`);
            results.processed++;
            continue;
          }

          // Trial has ended - generate first invoice and end trial
          console.log(`Trial ended for subscription ${subscription.id}. Generating first invoice.`);

          // Skip free plans (Start)
          if (price === 0) {
            console.log(`Skipping invoice for free plan, but ending trial for subscription ${subscription.id}`);
            
            const periodStart = new Date(today);
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await supabase
              .from("subscriptions")
              .update({
                is_trial: false,
                current_period_start: periodStart.toISOString(),
                current_period_end: periodEnd.toISOString(),
                notifications_used: 0,
                warnings_used: 0,
                fines_used: 0,
              })
              .eq("id", subscription.id);

            results.trialsEnded++;
            results.processed++;
            continue;
          }

          // Calculate new period dates (first billing period after trial)
          const periodStart = new Date(today);
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          // Calculate due date (15 days from period start)
          const dueDate = new Date(periodStart);
          dueDate.setDate(dueDate.getDate() + 15);

          // Create the first invoice after trial
          const { data: newInvoice, error: invoiceError } = await supabase.from("invoices").insert({
            subscription_id: subscription.id,
            condominium_id: subscription.condominium_id,
            amount: price,
            status: "pending",
            due_date: dueDate.toISOString().split("T")[0],
            period_start: periodStart.toISOString().split("T")[0],
            period_end: periodEnd.toISOString().split("T")[0],
            description: `Assinatura ${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} - Primeiro mês após período de teste - ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`,
          }).select("invoice_number").single();

          if (invoiceError) {
            console.error(`Error creating first invoice for subscription ${subscription.id}:`, invoiceError);
            results.errors.push(`Subscription ${subscription.id}: ${invoiceError.message}`);
            continue;
          }

          console.log(`Created first invoice after trial for subscription ${subscription.id}`);
          results.invoicesCreated++;
          results.trialsEnded++;

          // Send WhatsApp notification to síndico
          if (whatsappConfig) {
            const notifResult = await sendInvoiceNotification(
              supabase,
              subscription.condominium_id,
              newInvoice?.invoice_number || "",
              periodStart.toISOString().split("T")[0],
              periodEnd.toISOString().split("T")[0],
              price,
              dueDate.toISOString().split("T")[0],
              appBaseUrl,
              whatsappConfig as WhatsAppConfigRow
            );
            if (notifResult.success) {
              results.notificationsSent++;
            } else {
              results.notificationsFailed++;
              console.log(`WhatsApp notification failed for subscription ${subscription.id}: ${notifResult.error}`);
            }
          }

          // Update subscription - end trial and set new period
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              is_trial: false,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              notifications_used: 0,
              warnings_used: 0,
              fines_used: 0,
            })
            .eq("id", subscription.id);

          if (updateError) {
            console.error(`Error updating subscription ${subscription.id}:`, updateError);
            results.errors.push(`Subscription ${subscription.id} update: ${updateError.message}`);
          }

          results.processed++;
          continue;
        }

        // Not in trial - check if period ended (normal renewal flow)
        if (subscription.current_period_end) {
          const periodEnd = new Date(subscription.current_period_end);
          const todayDate = new Date(today);

          if (todayDate < periodEnd) {
            console.log(`Subscription ${subscription.id} period not yet ended (ends ${subscription.current_period_end}). Skipping.`);
            results.processed++;
            continue;
          }
        }

        // Period ended or no period set - generate renewal invoice

        // Skip free plans (Start)
        if (price === 0) {
          console.log(`Skipping free plan for subscription ${subscription.id}`);
          
          const periodStart = new Date(today);
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          await supabase
            .from("subscriptions")
            .update({
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              notifications_used: 0,
              warnings_used: 0,
              fines_used: 0,
            })
            .eq("id", subscription.id);

          results.processed++;
          continue;
        }

        // Calculate new period dates
        const periodStart = new Date(today);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        // Calculate due date (15 days from period start)
        const dueDate = new Date(periodStart);
        dueDate.setDate(dueDate.getDate() + 15);

        // Check if invoice already exists for this period
        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("subscription_id", subscription.id)
          .eq("period_start", periodStart.toISOString().split("T")[0])
          .maybeSingle();

        if (existingInvoice) {
          console.log(`Invoice already exists for subscription ${subscription.id} period ${periodStart.toISOString().split("T")[0]}`);
          results.processed++;
          continue;
        }

        // Create the renewal invoice
        const { data: renewalInvoice, error: invoiceError } = await supabase.from("invoices").insert({
          subscription_id: subscription.id,
          condominium_id: subscription.condominium_id,
          amount: price,
          status: "pending",
          due_date: dueDate.toISOString().split("T")[0],
          period_start: periodStart.toISOString().split("T")[0],
          period_end: periodEnd.toISOString().split("T")[0],
          description: `Assinatura ${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} - ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`,
        }).select("invoice_number").single();

        if (invoiceError) {
          console.error(`Error creating invoice for subscription ${subscription.id}:`, invoiceError);
          results.errors.push(`Subscription ${subscription.id}: ${invoiceError.message}`);
          continue;
        }

        console.log(`Created renewal invoice for subscription ${subscription.id}`);
        results.invoicesCreated++;

        // Send WhatsApp notification to síndico
        if (whatsappConfig) {
          const notifResult = await sendInvoiceNotification(
            supabase,
            subscription.condominium_id,
            renewalInvoice?.invoice_number || "",
            periodStart.toISOString().split("T")[0],
            periodEnd.toISOString().split("T")[0],
            price,
            dueDate.toISOString().split("T")[0],
            appBaseUrl,
            whatsappConfig as WhatsAppConfigRow
          );
          if (notifResult.success) {
            results.notificationsSent++;
          } else {
            results.notificationsFailed++;
            console.log(`WhatsApp notification failed for subscription ${subscription.id}: ${notifResult.error}`);
          }
        }

        // Update subscription period dates and reset usage counters
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            notifications_used: 0,
            warnings_used: 0,
            fines_used: 0,
          })
          .eq("id", subscription.id);

        if (updateError) {
          console.error(`Error updating subscription ${subscription.id}:`, updateError);
          results.errors.push(`Subscription ${subscription.id} update: ${updateError.message}`);
        }

        results.processed++;
      } catch (subError: any) {
        console.error(`Error processing subscription ${subscription.id}:`, subError);
        results.errors.push(`Subscription ${subscription.id}: ${subError.message}`);
      }
    }

    console.log("Invoice generation complete:", results);

    const finalResult = {
      success: true,
      message: "Invoice generation completed",
      results,
    };

    // Update log as success
    if (logId) {
      await supabase
        .from("edge_function_logs")
        .update({
          status: "success",
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result: finalResult,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify(finalResult),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in generate-invoices function:", error);

    // Update log as error
    if (logId) {
      await supabase
        .from("edge_function_logs")
        .update({
          status: "error",
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_message: error.message,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
