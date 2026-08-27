import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  return new Response(JSON.stringify({
    deprecated: true,
    gone: true,
    message: 'connect-guard-payout has been retired. This endpoint is no longer available (HTTP 410 Gone).',
    migrateTo: 'create-guard-payout',
    note: 'Payouts are handled by create-guard-payout (manual admin) and auto-release-guard-payments (cron). Connect onboarding is handled by create-guard-connect-account. This function performs no payouts and exposes no secrets.',
  }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});