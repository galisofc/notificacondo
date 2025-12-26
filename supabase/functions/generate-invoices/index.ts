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
}

const PLAN_PRICES: Record<string, number> = {
  start: 0,
  essencial: 49.90,
  profissional: 99.90,
  enterprise: 199.90,
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting invoice generation process...");

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Fetch all active subscriptions that need invoice generation
    // A subscription needs an invoice if:
    // 1. It has no current_period_end (new subscription)
    // 2. current_period_end is today or in the past (period ended)
    const { data: subscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, condominium_id, plan, active, current_period_start, current_period_end")
      .eq("active", true)
      .or(`current_period_end.is.null,current_period_end.lte.${today}`);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions to process`);

    const results = {
      processed: 0,
      invoicesCreated: 0,
      errors: [] as string[],
    };

    for (const subscription of subscriptions || []) {
      try {
        const price = PLAN_PRICES[subscription.plan] || 0;

        // Skip free plans (Start)
        if (price === 0) {
          console.log(`Skipping free plan for subscription ${subscription.id}`);
          
          // Still update the period dates for tracking
          const periodStart = new Date(today);
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          await supabase
            .from("subscriptions")
            .update({
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              // Reset usage counters for new period
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

        // Create the invoice
        const { error: invoiceError } = await supabase.from("invoices").insert({
          subscription_id: subscription.id,
          condominium_id: subscription.condominium_id,
          amount: price,
          status: "pending",
          due_date: dueDate.toISOString().split("T")[0],
          period_start: periodStart.toISOString().split("T")[0],
          period_end: periodEnd.toISOString().split("T")[0],
          description: `Assinatura ${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} - ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`,
        });

        if (invoiceError) {
          console.error(`Error creating invoice for subscription ${subscription.id}:`, invoiceError);
          results.errors.push(`Subscription ${subscription.id}: ${invoiceError.message}`);
          continue;
        }

        console.log(`Created invoice for subscription ${subscription.id}`);
        results.invoicesCreated++;

        // Update subscription period dates and reset usage counters
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            // Reset usage counters for new period
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice generation completed",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in generate-invoices function:", error);
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
