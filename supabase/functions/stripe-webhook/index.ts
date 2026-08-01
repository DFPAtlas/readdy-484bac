import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req) => {
  return new Response(
    JSON.stringify({ error: 'This webhook endpoint is deprecated. Use enhanced-stripe-webhook instead.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
});