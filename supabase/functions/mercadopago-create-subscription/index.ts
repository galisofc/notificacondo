import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  condominium_id: string;
  plan_slug: string;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      condominium_id,
      plan_slug,
      payer_email,
      back_url,
    }: CreateSubscriptionRequest = await req.json();

    console.log("Creating subscription for:", {
      condominium_id,
      plan_slug,
      payer_email,
    });

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .single();

    if (planError || !plan) {
      throw new Error(`Plan not found: ${plan_slug}`);
    }

    // Check if MercadoPago is configured
    const { data: mpConfig, error: mpConfigError } = await supabase
      .from("mercadopago_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (mpConfigError || !mpConfig) {
      throw new Error("MercadoPago not configured");
    }

    // If plan has no MP plan ID, need to create it first
    let mpPlanId = plan.mercadopago_plan_id;
    
    if (!mpPlanId && mercadoPagoAccessToken) {
      console.log("Creating subscription plan in MercadoPago...");
      
      const planResponse = await fetch(
        "https://api.mercadopago.com/preapproval_plan",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${mercadoPagoAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: `Plano ${plan.name} - NotificaCondo`,
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: plan.price,
              currency_id: "BRL",
            },
            back_url: back_url || `${mpConfig.notification_url || ""}/dashboard`,
          }),
        }
      );

      if (!planResponse.ok) {
        const errorText = await planResponse.text();
        console.error("MercadoPago plan creation error:", errorText);
        throw new Error(`Failed to create MP plan: ${errorText}`);
      }

      const planData = await planResponse.json();
      mpPlanId = planData.id;

      // Update plan with MP plan ID
      await supabase
        .from("plans")
        .update({ mercadopago_plan_id: mpPlanId })
        .eq("id", plan.id);

      console.log("Created MP plan:", mpPlanId);
    }

    // Create subscription (preapproval) - using direct auto_recurring without plan_id
    // This generates an init_point for the user to complete payment
    if (!mercadoPagoAccessToken) {
      throw new Error("MercadoPago access token not configured");
    }

    const subscriptionPayload: Record<string, any> = {
      reason: `Assinatura ${plan.name} - NotificaCondo`,
      external_reference: condominium_id,
      payer_email: payer_email,
      back_url: back_url || `${mpConfig.notification_url || ""}/sindico/subscriptions`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.price,
        currency_id: "BRL",
      },
      status: "pending",
    };

    // Only add preapproval_plan_id if it exists and we want to use it
    // For now, we'll create subscriptions without a plan_id to avoid card_token requirement
    if (mpPlanId) {
      console.log("Using existing MP plan ID:", mpPlanId);
      // Note: When using preapproval_plan_id, the user must complete checkout at init_point
      // The card_token_id is only required for direct card charging
    }

    console.log("Creating subscription with payload:", subscriptionPayload);

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MercadoPago subscription error:", errorText);
      throw new Error(`Failed to create subscription: ${errorText}`);
    }

    const subscriptionData = await response.json();
    console.log("MercadoPago subscription created:", subscriptionData.id);

    // Update subscription with MP preapproval ID
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        mercadopago_preapproval_id: subscriptionData.id,
      })
      .eq("condominium_id", condominium_id);

    if (updateError) {
      console.error("Error updating subscription:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: subscriptionData,
        init_point: subscriptionData.init_point,
        preapproval_id: subscriptionData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mercadopago-create-subscription:", error);
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
