import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const allowedOrigins = ['https://quickguard.uk', 'https://www.quickguard.uk'];
function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'https://quickguard.uk',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const headers = { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'app' }, global: { headers: { Authorization: authHeader || '' } } }
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return respond({ error: 'Unauthorized' }, 401);

  const { data: client } = await supabase.from('clients').select('id').eq('user_id', user.id).maybeSingle();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('user_id', user.id).maybeSingle();
  const { data: guard } = await supabase.from('guards').select('id').eq('user_id', user.id).maybeSingle();

  let query = supabase
    .from('job_completion_requests')
    .select(`
      id,
      job_id,
      guard_id,
      client_id,
      status,
      requested_at,
      completed_at,
      client_approved_at,
      client_disputed_at,
      dispute_reason,
      admin_approved_at,
      notes,
      created_at,
      jobs:job_id (job_title, venue_city, start_date, hourly_rate, agreed_amount, payment_status),
      guards:guard_id (full_name, profile_image_url, rating)
    `)
    .order('created_at', { ascending: false });

  if (client) {
    query = query.eq('client_id', client.id);
  } else if (guard) {
    query = query.eq('guard_id', guard.id);
  } else if (!admin) {
    return respond({ error: 'Not authorized' }, 403);
  }

  const { data, error } = await query;
  if (error) {
    return respond({ error: error.message }, 500);
  }

  return respond({ requests: data || [] }, 200);
  } catch (error) {
    console.error('[GetCompletionRequests]', error instanceof Error ? error.message : 'Unknown error');
    return respond({ error: 'Unable to load completion requests' }, 500);
  }
});
