import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// WhatsApp Provider configurations (same as send-whatsapp-notification)
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

async function sendWhatsAppMessage(
  phone: string, 
  message: string, 
  config: WhatsAppConfigRow
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const provider = config.provider || "zpro";
  const settings: ProviderSettings = {
    apiUrl: config.api_url,
    apiKey: config.api_key,
    instanceId: config.instance_id,
  };
  
  try {
    if (provider === "zpro") {
      const baseUrl = settings.apiUrl.replace(/\/$/, "");
      const phoneClean = phone.replace(/\D/g, "");
      
      const params = new URLSearchParams({
        body: message,
        number: phoneClean,
        externalKey: settings.apiKey,
        bearertoken: settings.apiKey,
        isClosed: "false"
      });
      
      const sendUrl = `${baseUrl}/params/?${params.toString()}`;
      console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
      
      const response = await fetch(sendUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const responseText = await response.text();
      console.log("Z-PRO response status:", response.status);
      
      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          return { success: true, messageId: `zpro_${Date.now()}` };
        }
        
        const extractedMessageId = data.id || data.messageId || data.key?.id || `zpro_${Date.now()}`;
        return { success: true, messageId: String(extractedMessageId) };
      }
      
      return { success: false, error: `Erro ${response.status}` };
    }
    
    // Default fallback for other providers
    return { success: false, error: `Provider ${provider} não suportado neste contexto` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

async function notifyPaymentConfirmed(
  supabase: any,
  invoice: any,
  paymentMethod: string
): Promise<void> {
  try {
    // Fetch WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !whatsappConfig) {
      console.log("WhatsApp not configured, skipping notification");
      return;
    }

    // Fetch condominium with owner info
    const { data: condominium, error: condoError } = await supabase
      .from("condominiums")
      .select(`
        id,
        name,
        owner_id
      `)
      .eq("id", invoice.condominium_id)
      .single();

    if (condoError || !condominium) {
      console.error("Condominium not found for invoice:", invoice.id);
      return;
    }

    // Fetch síndico profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", condominium.owner_id)
      .single();

    if (profileError || !profile) {
      console.error("Síndico profile not found for condominium:", condominium.id);
      return;
    }

    if (!profile.phone) {
      console.log("Síndico does not have phone number, skipping WhatsApp notification");
      return;
    }

    // Format payment method label
    const paymentMethodLabels: Record<string, string> = {
      "bank_transfer": "PIX",
      "pix": "PIX",
      "ticket": "Boleto",
      "bolbradesco": "Boleto",
      "credit_card": "Cartão de Crédito",
      "debit_card": "Cartão de Débito",
    };
    const methodLabel = paymentMethodLabels[paymentMethod] || paymentMethod;

    // Format amount
    const amountFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(invoice.amount);

    // Build notification message
    const message = `💰 *Pagamento Confirmado!*

🏢 *${condominium.name}*

Olá, *${profile.full_name}*!

Um pagamento foi confirmado:
📋 Fatura: ${invoice.description || `Período ${new Date(invoice.period_start).toLocaleDateString("pt-BR")} - ${new Date(invoice.period_end).toLocaleDateString("pt-BR")}`}
💳 Método: *${methodLabel}*
💵 Valor: *${amountFormatted}*
📅 Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}

✅ A fatura foi marcada como paga automaticamente.`;

    // Send WhatsApp notification
    const result = await sendWhatsAppMessage(profile.phone, message, whatsappConfig);

    if (result.success) {
      console.log(`Payment notification sent successfully to síndico: ${result.messageId}`);
    } else {
      console.error(`Failed to send payment notification: ${result.error}`);
    }
  } catch (error) {
    console.error("Error sending payment notification:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notification = await req.json();
    console.log("MercadoPago webhook received:", notification);

    const { type, data } = notification;

    // Handle subscription notifications
    if (type === "subscription_preapproval" || type === "subscription_authorized_payment") {
      const preapprovalId = data?.id;
      
      if (!preapprovalId) {
        console.log("No preapproval ID in notification");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get subscription details from MercadoPago
      if (mercadoPagoAccessToken) {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/preapproval/${preapprovalId}`,
          {
            headers: {
              "Authorization": `Bearer ${mercadoPagoAccessToken}`,
            },
          }
        );

        if (mpResponse.ok) {
          const preapprovalData = await mpResponse.json();
          console.log("Preapproval data:", preapprovalData);

          // Find subscription by preapproval ID
          const { data: subscription, error: subError } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("mercadopago_preapproval_id", preapprovalId)
            .single();

          if (subscription && !subError) {
            // Update subscription status based on preapproval status
            const isActive = preapprovalData.status === "authorized";
            
            await supabase
              .from("subscriptions")
              .update({
                active: isActive,
                current_period_start: preapprovalData.next_payment_date
                  ? new Date(preapprovalData.next_payment_date).toISOString()
                  : null,
                current_period_end: preapprovalData.next_payment_date
                  ? new Date(
                      new Date(preapprovalData.next_payment_date).setMonth(
                        new Date(preapprovalData.next_payment_date).getMonth() + 1
                      )
                    ).toISOString()
                  : null,
              })
              .eq("id", subscription.id);

            console.log(`Subscription ${subscription.id} updated with status: ${isActive ? "active" : "inactive"}`);
          }
        }
      }
    }

    // Handle payment notifications
    if (type === "payment") {
      const paymentId = data?.id;
      
      if (!paymentId || !mercadoPagoAccessToken) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get payment details
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            "Authorization": `Bearer ${mercadoPagoAccessToken}`,
          },
        }
      );

      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        console.log("Payment data:", paymentData);

        // If payment is approved, update invoice
        if (paymentData.status === "approved") {
          const externalReference = paymentData.external_reference;
          const paymentTypeId = paymentData.payment_type_id || paymentData.payment_method_id;
          
          if (externalReference) {
            // Check if external_reference is an invoice ID (UUID format)
            const isInvoiceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalReference);
            
            let invoice = null;
            
            if (isInvoiceId) {
              // Direct invoice lookup
              const { data: invoiceById } = await supabase
                .from("invoices")
                .select("*")
                .eq("id", externalReference)
                .single();
              invoice = invoiceById;
            } else {
              // Try to find invoice by condominium ID
              const { data: invoiceByCondoId } = await supabase
                .from("invoices")
                .select("*")
                .eq("condominium_id", externalReference)
                .eq("status", "pending")
                .order("due_date", { ascending: false })
                .limit(1)
                .single();
              invoice = invoiceByCondoId;
            }

            if (invoice) {
              // Update invoice as paid
              await supabase
                .from("invoices")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  payment_method: `mercadopago_${paymentTypeId}`,
                  payment_reference: paymentId.toString(),
                })
                .eq("id", invoice.id);

              console.log(`Invoice ${invoice.id} marked as paid via ${paymentTypeId}`);

              // Send WhatsApp notification to síndico (non-blocking)
              notifyPaymentConfirmed(supabase, { ...invoice, amount: paymentData.transaction_amount || invoice.amount }, paymentTypeId);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mercadopago-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Always return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ received: true, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
