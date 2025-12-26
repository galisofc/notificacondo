import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CancelSubscriptionRequest {
  preapproval_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mercadoPagoAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoAccessToken) {
      throw new Error("MercadoPago access token not configured");
    }

    const { preapproval_id }: CancelSubscriptionRequest = await req.json();

    console.log("Cancelling subscription:", preapproval_id);

    // Cancel subscription in MercadoPago
    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${preapproval_id}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${mercadoPagoAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MercadoPago cancellation error:", errorText);
      throw new Error(`Failed to cancel subscription: ${errorText}`);
    }

    const data = await response.json();
    console.log("Subscription cancelled:", data);

    // Update subscription in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("subscriptions")
      .update({ active: false })
      .eq("mercadopago_preapproval_id", preapproval_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription cancelled successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mercadopago-cancel-subscription:", error);
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
