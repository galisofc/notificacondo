import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProcessPaymentRequest {
  invoice_id: string;
  amount: number;
  form_data: {
    paymentType: string;
    selectedPaymentMethod: string;
    formData: {
      token?: string;
      issuer_id?: string;
      payment_method_id: string;
      transaction_amount: number;
      installments?: number;
      payer: {
        email?: string;
        identification?: {
          type?: string;
          number?: string;
        };
        first_name?: string;
        last_name?: string;
        address?: {
          zip_code?: string;
          street_name?: string;
          street_number?: string;
          neighborhood?: string;
          city?: string;
          federal_unit?: string;
        };
      };
      transaction_details?: {
        financial_institution?: string;
      };
    };
  };
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

    const { invoice_id, amount, form_data }: ProcessPaymentRequest = await req.json();

    console.log("Processing payment for invoice:", invoice_id);
    console.log("Payment type:", form_data.paymentType);
    console.log("Selected payment method:", form_data.selectedPaymentMethod);
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

    const { formData, paymentType } = form_data;

    // Build payment payload based on payment type
    let paymentPayload: Record<string, any> = {
      transaction_amount: amount,
      description: `Fatura - ${invoice.condominium?.name || "Condomínio"}`,
      payment_method_id: formData.payment_method_id,
      payer: {
        email: formData.payer.email,
      },
      external_reference: invoice_id,
      statement_descriptor: "NotificaCondo",
    };

    // Add payer identification if provided
    if (formData.payer.identification?.type && formData.payer.identification?.number) {
      paymentPayload.payer.identification = {
        type: formData.payer.identification.type,
        number: formData.payer.identification.number,
      };
    }

    // Add first_name and last_name if provided
    if (formData.payer.first_name) {
      paymentPayload.payer.first_name = formData.payer.first_name;
    }
    if (formData.payer.last_name) {
      paymentPayload.payer.last_name = formData.payer.last_name;
    }

    // Card payment specific fields
    if (paymentType === "credit_card" || paymentType === "debit_card") {
      if (formData.token) {
        paymentPayload.token = formData.token;
      }
      if (formData.installments) {
        paymentPayload.installments = formData.installments;
      }
      if (formData.issuer_id) {
        paymentPayload.issuer_id = parseInt(formData.issuer_id);
      }
    }

    // Bank transfer (PIX) - no additional fields needed

    // Ticket (Boleto) specific fields - requires address
    if (paymentType === "ticket") {
      // Boleto requires payer address information
      if (formData.payer.address) {
        paymentPayload.payer.address = {
          zip_code: formData.payer.address.zip_code,
          street_name: formData.payer.address.street_name,
          street_number: formData.payer.address.street_number,
          neighborhood: formData.payer.address.neighborhood,
          city: formData.payer.address.city,
          federal_unit: formData.payer.address.federal_unit,
        };
      } else {
        // If no address provided, use default placeholder address (required by MercadoPago)
        // This allows the boleto to be generated - user should update their address in profile
        console.log("No address provided for boleto, using placeholder address");
        paymentPayload.payer.address = {
          zip_code: "01310100",
          street_name: "Av Paulista",
          street_number: "1000",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          federal_unit: "SP",
        };
      }

      // transaction_details may include financial_institution
      if (formData.transaction_details?.financial_institution) {
        paymentPayload.transaction_details = {
          financial_institution: formData.transaction_details.financial_institution,
        };
      }
    }

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
    console.log("Payment status_detail:", paymentData.status_detail);

    // Determine payment method type for storing
    let paymentMethodType = "mercadopago";
    if (paymentType === "credit_card") {
      paymentMethodType = "mercadopago_credit_card";
    } else if (paymentType === "debit_card") {
      paymentMethodType = "mercadopago_debit_card";
    } else if (paymentType === "bank_transfer") {
      paymentMethodType = "mercadopago_pix";
    } else if (paymentType === "ticket") {
      paymentMethodType = "mercadopago_boleto";
    }

    // If payment is approved, update invoice status
    if (paymentData.status === "approved") {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: paymentMethodType,
          payment_reference: paymentData.id?.toString(),
        })
        .eq("id", invoice_id);

      if (updateError) {
        console.error("Error updating invoice:", updateError);
      } else {
        console.log("Invoice marked as paid:", invoice_id);
      }
    }

    // Build response with relevant data for frontend
    const responseData: Record<string, any> = {
      success: true,
      payment_id: paymentData.id,
      status: paymentData.status,
      status_detail: paymentData.status_detail,
    };

    // Include PIX data if available
    if (paymentData.point_of_interaction?.transaction_data) {
      const transactionData = paymentData.point_of_interaction.transaction_data;
      if (transactionData.qr_code) {
        responseData.qr_code = transactionData.qr_code;
      }
      if (transactionData.qr_code_base64) {
        responseData.qr_code_base64 = transactionData.qr_code_base64;
      }
      if (transactionData.ticket_url) {
        responseData.ticket_url = transactionData.ticket_url;
      }
    }

    // Include boleto URL if available
    if (paymentData.transaction_details?.external_resource_url) {
      responseData.ticket_url = paymentData.transaction_details.external_resource_url;
    }

    return new Response(
      JSON.stringify(responseData),
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
