
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { data: adminUser } = await supabase.from('admin_users').select('id, is_active').eq('user_id', user.id).maybeSingle();
  if (!adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const {
      page = 1,
      pageSize = 25,
      search = '',
      filterStatus = 'all',
      filterUrgency = 'all',
      filterCity = 'all',
      filterSia = false,
      filterFlagged = false,
      dateFrom = '',
      dateTo = '',
      sortBy = 'created_desc',
    } = body;

    let query = supabase
      .from('jobs')
      .select('id, job_title, venue_city, venue_postcode, venue_name, start_date, end_date, start_time, end_time, hourly_rate, number_of_guards, status, urgency, sia_licence_required, risk_level, is_deleted, created_at, clients(company_name, contact_name, email)', { count: 'exact' })
      .eq('is_deleted', false);

    if (filterStatus !== 'all') {
      if (filterStatus === 'flagged') {
        query = query.not('risk_level', 'is', null);
      } else {
        query = query.eq('status', filterStatus);
      }
    }
    if (filterUrgency !== 'all') {
      query = query.eq('urgency', filterUrgency);
    }
    if (filterCity !== 'all') {
      query = query.ilike('venue_city', filterCity);
    }
    if (filterSia) {
      query = query.eq('sia_licence_required', true);
    }
    if (filterFlagged) {
      query = query.not('risk_level', 'is', null);
    }
    if (dateFrom) {
      query = query.gte('start_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('start_date', dateTo);
    }

    if (search) {
      const s = '%' + search + '%';
      query = query.or(
        `job_title.ilike.${s},venue_city.ilike.${s},venue_postcode.ilike.${s},venue_name.ilike.${s}`
      );
    }

    switch (sortBy) {
      case 'created_desc':
        query = query.order('created_at', { ascending: false });
        break;
      case 'created_asc':
        query = query.order('created_at', { ascending: true });
        break;
      case 'pay_desc':
        query = query.order('hourly_rate', { ascending: false });
        break;
      case 'pay_asc':
        query = query.order('hourly_rate', { ascending: true });
        break;
      case 'start_soon':
        query = query.order('start_date', { ascending: true });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: rawJobs, error, count } = await query;
    if (error) throw error;

    const jobs = (rawJobs || []) as any[];
    const jobIds = jobs.map((j: any) => j.id);

    let appCountMap: Record<string, number> = {};
    let pendingCountMap: Record<string, number> = {};
    let assignCountMap: Record<string, number> = {};

    if (jobIds.length > 0) {
      const [appsRes, pendingRes, assignRes] = await Promise.all([
        supabase.from('job_applications').select('job_id').in('job_id', jobIds),
        supabase.from('job_applications').select('job_id').in('job_id', jobIds).eq('status', 'pending'),
        supabase.from('job_assignments').select('job_id').in('job_id', jobIds),
      ]);
      (appsRes.data || []).forEach((r: any) => { appCountMap[r.job_id] = (appCountMap[r.job_id] || 0) + 1; });
      (pendingRes.data || []).forEach((r: any) => { pendingCountMap[r.job_id] = (pendingCountMap[r.job_id] || 0) + 1; });
      (assignRes.data || []).forEach((r: any) => { assignCountMap[r.job_id] = (assignCountMap[r.job_id] || 0) + 1; });
    }

    const enriched = jobs.map((job: any) => ({
      ...job,
      applications_count: appCountMap[job.id] ?? 0,
      assigned_count: assignCountMap[job.id] ?? 0,
      pending_applications_count: pendingCountMap[job.id] ?? 0,
    }));

    const [
      { count: totalAll },
      { count: totalOpen },
      { count: totalInProgress },
      { count: totalCompleted },
      { count: totalCancelled },
      { count: totalFlagged },
      { count: totalPendingApps },
    ] = await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'open'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'in_progress'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'completed'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'cancelled'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).not('risk_level', 'is', null),
      supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const stats = {
      total: totalAll || 0,
      open: totalOpen || 0,
      in_progress: totalInProgress || 0,
      completed: totalCompleted || 0,
      cancelled: totalCancelled || 0,
      pending_apps: totalPendingApps || 0,
      flagged: totalFlagged || 0,
    };

    return new Response(JSON.stringify({ data: enriched, totalCount: count || 0, stats, page, pageSize }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('admin-jobs error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
