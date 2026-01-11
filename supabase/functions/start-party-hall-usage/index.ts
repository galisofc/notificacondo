import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logId = crypto.randomUUID();
  const startTime = new Date();

  try {
    // Log start
    await supabase.from('edge_function_logs').insert({
      id: logId,
      function_name: 'start-party-hall-usage',
      status: 'running',
      trigger_type: 'scheduled',
      started_at: startTime.toISOString(),
    });

    // Check if function is paused
    const { data: pauseStatus } = await supabase
      .from('cron_job_controls')
      .select('paused')
      .eq('function_name', 'start-party-hall-usage')
      .single();

    if (pauseStatus?.paused) {
      console.log('Function is paused, skipping execution');
      
      await supabase
        .from('edge_function_logs')
        .update({
          status: 'skipped',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          result: { message: 'Function is paused' },
        })
        .eq('id', logId);

      return new Response(
        JSON.stringify({ success: true, message: 'Function is paused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date in São Paulo timezone
    const now = new Date();
    const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const today = saoPauloDate.toISOString().split('T')[0];

    console.log(`Looking for confirmed bookings for today: ${today}`);

    // Find all confirmed bookings for today
    const { data: bookings, error: bookingsError } = await supabase
      .from('party_hall_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        resident_id,
        condominium_id,
        party_hall_setting_id
      `)
      .eq('booking_date', today)
      .eq('status', 'confirmed');

    if (bookingsError) {
      throw new Error(`Error fetching bookings: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      console.log('No confirmed bookings found for today');
      
      await supabase
        .from('edge_function_logs')
        .update({
          status: 'success',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          result: { 
            message: 'No confirmed bookings found for today',
            date: today,
            bookingsProcessed: 0
          },
        })
        .eq('id', logId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No confirmed bookings found for today',
          date: today,
          bookingsProcessed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${bookings.length} confirmed bookings for today`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ bookingId: string; success: boolean; error?: string }> = [];

    // Update each booking to 'in_use' status
    for (const booking of bookings) {
      try {
        const { error: updateError } = await supabase
          .from('party_hall_bookings')
          .update({ status: 'in_use' })
          .eq('id', booking.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`Booking ${booking.id} status updated to 'in_use'`);
        successCount++;
        results.push({ bookingId: booking.id, success: true });
      } catch (error) {
        console.error(`Error updating booking ${booking.id}:`, error);
        errorCount++;
        results.push({ 
          bookingId: booking.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Update log with results
    await supabase
      .from('edge_function_logs')
      .update({
        status: errorCount > 0 ? 'partial' : 'success',
        ended_at: endTime.toISOString(),
        duration_ms: duration,
        result: {
          date: today,
          totalBookings: bookings.length,
          successCount,
          errorCount,
          results,
        },
      })
      .eq('id', logId);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        totalBookings: bookings.length,
        successCount,
        errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-party-hall-usage:', error);

    await supabase
      .from('edge_function_logs')
      .update({
        status: 'error',
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime.getTime(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', logId);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
