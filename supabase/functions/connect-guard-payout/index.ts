
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  return new Response(JSON.stringify({
    deprecated: true,
    message: 'connect-guard-payout is deprecated. Use create-guard-payout instead. This function will be retired.',
    migrateTo: 'create-guard-payout',
    note: 'Payouts are now handled by create-guard-payout. Manual payout via create-guard-payout is available for admin use. Auto-release is handled by approve-job-completion and auto-release-guard-payments.',
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
