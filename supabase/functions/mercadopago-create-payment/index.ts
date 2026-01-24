import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  invoice_id: string;
  payer_email: string;
  back_url?: string;
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

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoice_id, payer_email, back_url }: CreatePaymentRequest = await req.json();

    console.log("Creating payment for invoice:", invoice_id, "by user:", user.id);

    // Get invoice details with condominium owner info
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        condominium:condominiums(name, owner_id)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoice_id}`);
    }

    // Verify user has permission (is condominium owner or super_admin)
    const condoOwnerId = (invoice.condominium as { name: string; owner_id: string })?.owner_id;
    
    if (condoOwnerId !== user.id) {
      // Check if user is super_admin
      const { data: roleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      
      if (!roleCheck) {
        return new Response(
          JSON.stringify({ error: "Forbidden - You do not have permission to create payments for this invoice" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if MercadoPago is configured
    const { data: mpConfig } = await supabase
      .from("mercadopago_config")
      .select("*")
      .eq("is_active", true)
      .single();

    // Create preference for checkout
    const preferencePayload = {
      items: [
        {
          title: `Fatura - ${invoice.condominium?.name || "Condomínio"}`,
          description: invoice.description || `Período: ${invoice.period_start} a ${invoice.period_end}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(invoice.amount),
        },
      ],
      payer: {
        email: payer_email,
      },
      external_reference: invoice_id,
      back_urls: {
        success: back_url || `${mpConfig?.notification_url || ""}/sindico/invoices?status=success`,
        failure: back_url || `${mpConfig?.notification_url || ""}/sindico/invoices?status=failure`,
        pending: back_url || `${mpConfig?.notification_url || ""}/sindico/invoices?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "NotificaCondo",
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
    };

    console.log("Creating preference with payload:", preferencePayload);

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mercadoPagoAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferencePayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MercadoPago preference error:", errorText);
      throw new Error(`Failed to create payment preference: ${errorText}`);
    }

    const preferenceData = await response.json();
    console.log("MercadoPago preference created:", preferenceData.id);

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: preferenceData.id,
        init_point: preferenceData.init_point,
        sandbox_init_point: preferenceData.sandbox_init_point,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mercadopago-create-payment:", error);
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
