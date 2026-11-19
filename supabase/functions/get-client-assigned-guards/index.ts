import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const readAll = async (makeQuery: () => any) => {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await makeQuery().range(offset, offset + 199);
    if (error || !Array.isArray(data)) throw error || new Error('Invalid assigned profiles');
    rows.push(...data);
    if (data.length < 200) return rows;
  }
};

// This projection matches client-visible profile fields. Never return private
// documents, address, phone, email, bank details or arbitrary guard IDs.
const fields = 'id, user_id, full_name, profile_image_url, rating, hourly_rate, sia_licence_number, sia_verified, sia_expiry_date, licence_types, profile_completed, verification_status, certifications, sia_verified_at, total_reviews, total_jobs_completed, is_active';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (!token) return json(401, { error: 'Unauthorized' });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'app' }, auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json(401, { error: 'Unauthorized' });
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid job' }); }
    if (!body || typeof body.job_id !== 'string' || !uuid.test(body.job_id)) return json(400, { error: 'Invalid job' });
    const closure = await db.from('account_closures').select('user_id').eq('user_id', user.id).maybeSingle();
    if (closure.error) throw closure.error;
    if (closure.data) return json(403, { error: 'Account closed' });

    const { data: client, error: clientError } = await db.from('clients').select('id').eq('user_id', user.id).maybeSingle();
    if (clientError) throw clientError;
    if (!client) return json(403, { error: 'Client account required' });
    const { data: job, error: jobError } = await db.from('jobs').select('id').eq('id', body.job_id)
      .eq('client_id', client.id).or('is_deleted.is.null,is_deleted.eq.false').maybeSingle();
    if (jobError) throw jobError;
    if (!job) return json(404, { error: 'Job not found' });
    const assignments = await readAll(() => db.from('job_assignments')
      .select('id, guard_id').eq('job_id', job.id).order('id', { ascending: true }));
    const guardIds = [...new Set(assignments.map(row => row.guard_id).filter(Boolean))];
    if (!guardIds.length) return json(200, { profiles: [] });
    const profiles: any[] = [];
    for (let offset = 0; offset < guardIds.length; offset += 100) {
      profiles.push(...await readAll(() => db.from('guards').select(fields).in('id', guardIds.slice(offset, offset + 100)).order('id', { ascending: true })));
    }
    // Whitelist again when serializing so later query changes cannot expose
    // private columns. Inactive guards remain identifiable on past assignments.
    const safeProfiles = (profiles || []).map(row => Object.fromEntries(fields.split(', ').map(key => [key, row[key]])));
    return json(200, { profiles: safeProfiles });
  } catch { return json(503, { error: 'Assigned guard profiles could not be loaded. Please try again.' }); }
});
