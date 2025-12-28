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
  is_trial: boolean;
  trial_ends_at: string | null;
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
    // 1. Trial has ended (trial_ends_at is today or in the past) AND is_trial is true
    // 2. Or: has no current_period_end (new subscription after trial)
    // 3. Or: current_period_end is today or in the past (period ended)
    const { data: subscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, condominium_id, plan, active, current_period_start, current_period_end, is_trial, trial_ends_at")
      .eq("active", true);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} total active subscriptions to evaluate`);

    const results = {
      processed: 0,
      invoicesCreated: 0,
      trialsEnded: 0,
      errors: [] as string[],
    };

    for (const subscription of subscriptions || []) {
      try {
        const price = PLAN_PRICES[subscription.plan] || 0;

        // Check if subscription is still in trial period
        if (subscription.is_trial && subscription.trial_ends_at) {
          const trialEnd = new Date(subscription.trial_ends_at);
          const todayDate = new Date(today);

          // If trial hasn't ended yet, skip this subscription
          if (todayDate < trialEnd) {
            console.log(`Subscription ${subscription.id} is still in trial period (ends ${subscription.trial_ends_at}). Skipping.`);
            results.processed++;
            continue;
          }

          // Trial has ended - generate first invoice and end trial
          console.log(`Trial ended for subscription ${subscription.id}. Generating first invoice.`);

          // Skip free plans (Start)
          if (price === 0) {
            console.log(`Skipping invoice for free plan, but ending trial for subscription ${subscription.id}`);
            
            const periodStart = new Date(today);
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await supabase
              .from("subscriptions")
              .update({
                is_trial: false,
                current_period_start: periodStart.toISOString(),
                current_period_end: periodEnd.toISOString(),
                notifications_used: 0,
                warnings_used: 0,
                fines_used: 0,
              })
              .eq("id", subscription.id);

            results.trialsEnded++;
            results.processed++;
            continue;
          }

          // Calculate new period dates (first billing period after trial)
          const periodStart = new Date(today);
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          // Calculate due date (15 days from period start)
          const dueDate = new Date(periodStart);
          dueDate.setDate(dueDate.getDate() + 15);

          // Create the first invoice after trial
          const { error: invoiceError } = await supabase.from("invoices").insert({
            subscription_id: subscription.id,
            condominium_id: subscription.condominium_id,
            amount: price,
            status: "pending",
            due_date: dueDate.toISOString().split("T")[0],
            period_start: periodStart.toISOString().split("T")[0],
            period_end: periodEnd.toISOString().split("T")[0],
            description: `Assinatura ${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} - Primeiro mês após período de teste - ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`,
          });

          if (invoiceError) {
            console.error(`Error creating first invoice for subscription ${subscription.id}:`, invoiceError);
            results.errors.push(`Subscription ${subscription.id}: ${invoiceError.message}`);
            continue;
          }

          console.log(`Created first invoice after trial for subscription ${subscription.id}`);
          results.invoicesCreated++;
          results.trialsEnded++;

          // Update subscription - end trial and set new period
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              is_trial: false,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
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
          continue;
        }

        // Not in trial - check if period ended (normal renewal flow)
        if (subscription.current_period_end) {
          const periodEnd = new Date(subscription.current_period_end);
          const todayDate = new Date(today);

          if (todayDate < periodEnd) {
            console.log(`Subscription ${subscription.id} period not yet ended (ends ${subscription.current_period_end}). Skipping.`);
            results.processed++;
            continue;
          }
        }

        // Period ended or no period set - generate renewal invoice

        // Skip free plans (Start)
        if (price === 0) {
          console.log(`Skipping free plan for subscription ${subscription.id}`);
          
          const periodStart = new Date(today);
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          await supabase
            .from("subscriptions")
            .update({
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
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

        // Create the renewal invoice
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

        console.log(`Created renewal invoice for subscription ${subscription.id}`);
        results.invoicesCreated++;

        // Update subscription period dates and reset usage counters
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
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
