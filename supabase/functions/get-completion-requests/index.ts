import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'app' }, global: { headers: { Authorization: authHeader || '' } } }
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

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
    return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });
  }

  const { data, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ requests: data || [] }), { status: 200 });
});
