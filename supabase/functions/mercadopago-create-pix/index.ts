import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreatePixRequest {
  invoice_id: string;
  payer_email: string;
  payer_first_name?: string;
  payer_last_name?: string;
  payer_identification_type?: string;
  payer_identification_number?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoAccessToken) {
      console.error("MercadoPago access token not configured");
      throw new Error("MercadoPago access token not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreatePixRequest = await req.json();
    const { 
      invoice_id, 
      payer_email,
      payer_first_name = "Cliente",
      payer_last_name = "NotificaCondo",
      payer_identification_type = "CPF",
      payer_identification_number = "00000000000"
    } = body;

    console.log("Creating PIX payment for invoice:", invoice_id);

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        condominium:condominiums(name, owner_id)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoice_id, invoiceError);
      throw new Error(`Invoice not found: ${invoice_id}`);
    }

    console.log("Invoice found:", invoice.invoice_number, "Amount:", invoice.amount);

    // Create PIX payment
    const paymentPayload = {
      transaction_amount: Number(invoice.amount),
      description: `Fatura ${invoice.invoice_number || invoice_id} - ${invoice.condominium?.name || "Condomínio"}`,
      payment_method_id: "pix",
      payer: {
        email: payer_email,
        first_name: payer_first_name,
        last_name: payer_last_name,
        identification: {
          type: payer_identification_type,
          number: payer_identification_number.replace(/\D/g, ""),
        },
      },
      external_reference: invoice_id,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
    };

    console.log("Creating PIX payment with payload:", JSON.stringify(paymentPayload));

    const response = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mercadoPagoAccessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `pix-${invoice_id}-${Date.now()}`,
        },
        body: JSON.stringify(paymentPayload),
      }
    );

    const responseText = await response.text();
    console.log("MercadoPago response status:", response.status);
    console.log("MercadoPago response:", responseText);

    if (!response.ok) {
      console.error("MercadoPago PIX error:", responseText);
      throw new Error(`Failed to create PIX payment: ${responseText}`);
    }

    const paymentData = JSON.parse(responseText);
    console.log("PIX payment created successfully, ID:", paymentData.id);

    // Extract PIX data
    const pixData = paymentData.point_of_interaction?.transaction_data;
    
    if (!pixData) {
      console.error("PIX data not found in response:", paymentData);
      throw new Error("PIX data not returned from MercadoPago");
    }

    console.log("PIX QR Code available:", !!pixData.qr_code_base64);
    console.log("PIX Copy-Paste available:", !!pixData.qr_code);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        status: paymentData.status,
        qr_code: pixData.qr_code, // Código copia e cola
        qr_code_base64: pixData.qr_code_base64, // Imagem do QR Code em base64
        ticket_url: pixData.ticket_url,
        expiration_date: paymentData.date_of_expiration,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mercadopago-create-pix:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
