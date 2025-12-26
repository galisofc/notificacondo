import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProcessPaymentRequest {
  invoice_id: string;
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id: string;
  payer_email: string;
  amount: number;
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
      throw new Error("MercadoPago access token not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      invoice_id,
      token,
      payment_method_id,
      installments,
      issuer_id,
      payer_email,
      amount,
    }: ProcessPaymentRequest = await req.json();

    console.log("Processing payment for invoice:", invoice_id);
    console.log("Payment method:", payment_method_id);
    console.log("Amount:", amount);

    // Get invoice details to validate
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        condominium:condominiums(name)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoice_id}`);
    }

    // Validate amount matches invoice
    if (Math.abs(Number(invoice.amount) - amount) > 0.01) {
      console.error("Amount mismatch:", { invoice: invoice.amount, received: amount });
      throw new Error("Payment amount does not match invoice amount");
    }

    // Create payment using MercadoPago API
    const paymentPayload = {
      transaction_amount: amount,
      token: token,
      description: `Fatura - ${invoice.condominium?.name || "Condomínio"}`,
      installments: installments,
      payment_method_id: payment_method_id,
      issuer_id: issuer_id ? parseInt(issuer_id) : undefined,
      payer: {
        email: payer_email,
      },
      external_reference: invoice_id,
      statement_descriptor: "NotificaCondo",
    };

    console.log("Creating payment with payload:", JSON.stringify(paymentPayload, null, 2));

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${invoice_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await response.json();

    if (!response.ok) {
      console.error("MercadoPago payment error:", paymentData);
      throw new Error(
        paymentData.message || 
        paymentData.cause?.[0]?.description || 
        "Failed to process payment"
      );
    }

    console.log("MercadoPago payment created:", paymentData.id);
    console.log("Payment status:", paymentData.status);

    // If payment is approved, update invoice status
    if (paymentData.status === "approved") {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: "mercadopago_card",
          payment_reference: paymentData.id?.toString(),
        })
        .eq("id", invoice_id);

      if (updateError) {
        console.error("Error updating invoice:", updateError);
      } else {
        console.log("Invoice marked as paid:", invoice_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        status: paymentData.status,
        status_detail: paymentData.status_detail,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mercadopago-process-payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
