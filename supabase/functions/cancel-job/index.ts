import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Compatibility route for older published clients. All writes use the same atomic RPC.
serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const allowed = ['https://quickguard.uk', 'https://www.quickguard.uk', 'https://readdy.ai'].includes(origin) || /^https:\/\/[^/]+\.readdy\.ai$/.test(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowed ? origin : 'https://quickguard.uk', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed) return respond({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) return respond({ error: 'Authentication required' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return respond({ error: 'Unauthorized' }, 401);
    const body = await req.json();
    if (body.cancelledBy !== 'client' || !body.jobId) return respond({ error: 'Client cancellation and jobId required' }, 400);
    const { data, error } = await client.rpc('cancel_client_job', { p_job_id: body.jobId, p_reason: body.reason || null, p_notes: body.notes || null, p_resolution: body.preferredResolution || null, p_contact: body.contactPreference || null });
    if (error) return respond({ error: error.message }, 400);
    return respond(data, 200);
  } catch {
    return respond({ error: 'Cancellation could not be confirmed. Refresh before retrying.' }, 400);
  }
});
