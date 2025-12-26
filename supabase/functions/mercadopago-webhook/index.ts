import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
          
          if (externalReference) {
            // Try to find invoice by subscription ID or condominium ID
            const { data: invoice } = await supabase
              .from("invoices")
              .select("*")
              .eq("condominium_id", externalReference)
              .eq("status", "pending")
              .order("due_date", { ascending: false })
              .limit(1)
              .single();

            if (invoice) {
              await supabase
                .from("invoices")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  payment_method: paymentData.payment_type_id,
                  payment_reference: paymentId.toString(),
                })
                .eq("id", invoice.id);

              console.log(`Invoice ${invoice.id} marked as paid`);
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
