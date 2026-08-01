import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  return new Response(JSON.stringify({
    deprecated: true,
    message: 'connect-guard-payout is deprecated. Use release-guard-payment instead. This function will be retired.',
    migrateTo: 'release-guard-payment',
    note: 'Payouts are now automatically triggered by approve-job-completion. Manual payout via release-guard-payment is still available for admin use.',
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
