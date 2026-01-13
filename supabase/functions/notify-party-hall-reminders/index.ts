import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProviderConfig {
  sendMessage: (config: WhatsAppConfig, phone: string, message: string) => Promise<{ messageId?: string; error?: string }>;
}

interface WhatsAppConfig {
  api_url: string;
  api_key: string;
  instance_id: string;
  provider: string;
}

const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55")) {
    return cleaned;
  }
  return `55${cleaned}`;
};

// Helper to safely parse JSON response
const safeParseResponse = async (response: Response, providerName: string): Promise<{ data?: any; error?: string }> => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  
  console.log(`[${providerName}] Response status: ${response.status}, content-type: ${contentType}`);
  console.log(`[${providerName}] Response body (first 500 chars): ${text.substring(0, 500)}`);
  
  if (!contentType.includes("application/json") && !text.startsWith("{") && !text.startsWith("[")) {
    console.error(`[${providerName}] Expected JSON but received: ${contentType}`);
    return { error: `API retornou conteúdo não-JSON. Status: ${response.status}. Verifique a URL e credenciais da API.` };
  }
  
  try {
    const data = JSON.parse(text);
    return { data };
  } catch (e) {
    console.error(`[${providerName}] Failed to parse JSON:`, e);
    return { error: `Falha ao processar resposta da API: ${text.substring(0, 200)}` };
  }
};

const providers: Record<string, ProviderConfig> = {
  zpro: {
    // Z-PRO uses GET with query parameters
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const baseUrl = config.api_url.replace(/\/$/, "");
      
      const params = new URLSearchParams({
        body: message,
        number: formattedPhone,
        externalKey: config.api_key,
        bearertoken: config.api_key,
        isClosed: "false"
      });
      
      const url = `${baseUrl}/params/?${params.toString()}`;
      console.log(`[Z-PRO] Sending to URL: ${url.substring(0, 150)}...`);
      
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        
        const { data: result, error: parseError } = await safeParseResponse(response, "Z-PRO");
        
        if (parseError) {
          return { error: parseError };
        }
        
        if (response.ok) {
          const extractedMessageId = result?.id || result?.messageId || result?.key?.id || result?.msgId || result?.message_id;
          
          if (extractedMessageId && extractedMessageId !== "sent") {
            return { messageId: String(extractedMessageId) };
          }
          
          if (result?.status === "success" || result?.status === "PENDING" || response.status === 200) {
            const trackingId = `zpro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log(`[Z-PRO] No message ID in response, using tracking ID: ${trackingId}`);
            return { messageId: trackingId };
          }
          
          return { messageId: `zpro_${Date.now()}` };
        }
        
        return { error: result?.message || result?.error || `Erro ${response.status}` };
      } catch (error: any) {
        console.error(`[Z-PRO] Connection error:`, error);
        return { error: `Erro de conexão: ${error.message}` };
      }
    },
  },
  zapi: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const url = `${config.api_url}/instances/${config.instance_id}/token/${config.api_key}/send-text`;
      console.log(`[Z-API] Sending to URL: ${url.replace(config.api_key, "***")}`);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: formattedPhone, message }),
        });
        
        const { data: result, error: parseError } = await safeParseResponse(response, "Z-API");
        if (parseError) {
          return { error: parseError };
        }
        
        if (!response.ok) {
          return { error: result?.message || `Erro ao enviar mensagem via Z-API (status: ${response.status})` };
        }
        return { messageId: result?.messageId || result?.zapiMessageId };
      } catch (error: any) {
        console.error(`[Z-API] Connection error:`, error);
        return { error: `Erro de conexão: ${error.message}` };
      }
    },
  },
  evolution: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const url = `${config.api_url}/message/sendText/${config.instance_id}`;
      console.log(`[Evolution] Sending to URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: config.api_key },
          body: JSON.stringify({ number: formattedPhone, text: message }),
        });
        
        const { data: result, error: parseError } = await safeParseResponse(response, "Evolution");
        if (parseError) {
          return { error: parseError };
        }
        
        if (!response.ok) {
          return { error: result?.message || `Erro ao enviar mensagem via Evolution (status: ${response.status})` };
        }
        return { messageId: result?.key?.id };
      } catch (error: any) {
        console.error(`[Evolution] Connection error:`, error);
        return { error: `Erro de conexão: ${error.message}` };
      }
    },
  },
  wppconnect: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const url = `${config.api_url}/api/${config.instance_id}/send-message`;
      console.log(`[WPPConnect] Sending to URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.api_key}` },
          body: JSON.stringify({ phone: formattedPhone, message, isGroup: false }),
        });
        
        const { data: result, error: parseError } = await safeParseResponse(response, "WPPConnect");
        if (parseError) {
          return { error: parseError };
        }
        
        if (!response.ok || result?.status === "error") {
          return { error: result?.message || `Erro ao enviar mensagem via WPPConnect (status: ${response.status})` };
        }
        return { messageId: result?.id };
      } catch (error: any) {
        console.error(`[WPPConnect] Connection error:`, error);
        return { error: `Erro de conexão: ${error.message}` };
      }
    },
  },
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
        await supabase
          .from("edge_function_logs")
          .update({
            status: "skipped",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            result: { message: "Function is paused" },
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Function is paused" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate tomorrow's date (in Brazil timezone)
    const now = new Date();
    const brazilOffset = -3 * 60; // UTC-3
    const localNow = new Date(now.getTime() + (brazilOffset - now.getTimezoneOffset()) * 60 * 1000);
    const tomorrow = new Date(localNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`Checking for bookings on ${tomorrowStr}`);

    // Fetch confirmed bookings for tomorrow that haven't been notified yet
    const { data: bookings, error: bookingsError } = await supabase
      .from("party_hall_bookings")
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        notification_sent_at,
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
        await supabase
          .from("edge_function_logs")
          .update({
            status: "completed",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            result: { message: "No bookings to notify", date: tomorrowStr },
          })
          .eq("id", logId);
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

    // Get template
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("slug", "party_hall_reminder")
      .eq("is_active", true)
      .single();

    const provider = providers[whatsappConfig.provider];
    if (!provider) {
      throw new Error(`Unknown WhatsApp provider: ${whatsappConfig.provider}`);
    }

    const results: { bookingId: string; success: boolean; error?: string }[] = [];

    // Process each booking
    for (const booking of bookings) {
      const resident = booking.resident as any;
      const condo = booking.condominium as any;
      const hallSetting = booking.party_hall_setting as any;

      if (!resident.phone) {
        console.log(`Skipping booking ${booking.id}: no phone number`);
        results.push({ bookingId: booking.id, success: false, error: "No phone number" });
        continue;
      }

      // Fetch checklist items for this condominium
      const { data: checklistItems } = await supabase
        .from("party_hall_checklist_templates")
        .select("item_name, category")
        .eq("condominium_id", condo.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      // Format checklist for message
      let checklistText = "";
      if (checklistItems && checklistItems.length > 0) {
        // Group by category
        const grouped: Record<string, string[]> = {};
        for (const item of checklistItems) {
          const cat = item.category || "Geral";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item.item_name);
        }

        const lines: string[] = [];
        for (const [category, items] of Object.entries(grouped)) {
          lines.push(`\n📌 *${category}:*`);
          for (const item of items) {
            lines.push(`   ☐ ${item}`);
          }
        }
        checklistText = `\n📋 *Itens que serão verificados no checklist:*${lines.join("\n")}`;
      }

      // Format date
      const bookingDate = new Date(booking.booking_date + "T00:00:00");
      const formattedDate = bookingDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      // Build message
      let message: string;
      if (template?.content) {
        message = template.content
          .replace("{condominio}", condo.name)
          .replace("{nome}", resident.full_name.split(" ")[0])
          .replace("{espaco}", hallSetting.name)
          .replace("{data}", formattedDate)
          .replace("{horario_inicio}", booking.start_time.slice(0, 5))
          .replace("{horario_fim}", booking.end_time.slice(0, 5))
          .replace("{checklist}", checklistText);
      } else {
        message = `🎉 *LEMBRETE DE RESERVA*

🏢 *${condo.name}*

Olá, *${resident.full_name.split(" ")[0]}*!

Sua reserva do *${hallSetting.name}* está confirmada para *AMANHÃ*:
📅 *Data:* ${formattedDate}
⏰ *Horário:* ${booking.start_time.slice(0, 5)} às ${booking.end_time.slice(0, 5)}
${checklistText}

📋 *Lembre-se:*
• Compareça no horário para o checklist de entrada
• Traga documento de identificação
• Respeite as regras do espaço

Em caso de dúvidas, entre em contato com a administração.

Boa festa! 🎊`;
      }

      try {
        const result = await provider.sendMessage(
          whatsappConfig as WhatsAppConfig,
          resident.phone,
          message
        );

        if (result.error) {
          console.error(`Error sending notification for booking ${booking.id}:`, result.error);
          results.push({ bookingId: booking.id, success: false, error: result.error });
        } else {
          // Update booking with notification timestamp
          await supabase
            .from("party_hall_bookings")
            .update({ notification_sent_at: new Date().toISOString() })
            .eq("id", booking.id);

          console.log(`Notification sent for booking ${booking.id}`);
          results.push({ bookingId: booking.id, success: true });
        }
      } catch (sendError: any) {
        console.error(`Error processing booking ${booking.id}:`, sendError);
        results.push({ bookingId: booking.id, success: false, error: sendError.message });
      }

      // Small delay between messages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`Notifications completed: ${successCount} sent, ${failureCount} failed`);

    // Update log entry
    if (logId) {
      await supabase
        .from("edge_function_logs")
        .update({
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
        })
        .eq("id", logId);
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

    // Update log entry with error
    if (logId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
