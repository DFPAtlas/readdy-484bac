import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, company_name, total_spent')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!client) {
      return new Response(
        JSON.stringify({
          client: null,
          jobs: [],
          stats: null,
          totalCount: 0,
          page: 1,
          pageSize: 10,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = client.id;

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const page = Math.max(1, parseInt(String(body.page)) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(String(body.pageSize)) || 10));
    const search = (body.search || '').trim();
    const statusFilter = (body.status || 'all').trim();
    const paymentFilter = (body.payment || 'all').trim();
    const guardSearch = (body.guardSearch || '').trim();
    const dateFrom = (body.dateFrom || '').trim();
    const dateTo = (body.dateTo || '').trim();
    const offset = (page - 1) * pageSize;

    function buildCountQuery() {
      let q = supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('client_id', clientId)
        .eq('is_deleted', false);
      if (search) {
        q = q.or(`job_title.ilike.%${search}%,venue_city.ilike.%${search}%,venue_postcode.ilike.%${search}%`);
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'posted') q = q.in('status', ['open', 'posted']);
        else if (statusFilter === 'awaiting_payment') q = q.in('payment_status', ['pending', 'awaiting_payment']);
        else if (statusFilter === 'funded') q = q.in('payment_status', ['funded', 'paid']);
        else if (statusFilter === 'in_progress') q = q.in('status', ['in_progress', 'active']);
        else if (statusFilter === 'completed') q = q.eq('status', 'completed');
        else if (statusFilter === 'disputed') q = q.eq('disputed', true);
        else if (statusFilter === 'refunded') q = q.not('refunded_at', 'is', null);
        else if (statusFilter === 'cancelled') q = q.eq('status', 'cancelled');
      }
      if (paymentFilter !== 'all') {
        q = q.eq('payment_status', paymentFilter);
      }
      if (dateFrom) q = q.gte('start_date', dateFrom);
      if (dateTo) q = q.lte('start_date', dateTo);
      return q;
    }

    function buildDataQuery() {
      let q = supabase
        .from('jobs')
        .select(`
          id, job_title, venue_city, venue_postcode,
          start_date, end_date, start_time, end_time,
          hourly_rate, agreed_amount, number_of_guards,
          status, payment_status, stripe_payment_intent_id,
          platform_fee, guard_payout_amount,
          created_at, updated_at, applications_count, assigned_count,
          disputed, disputed_at, disputed_reason, is_deleted,
          cancelled_at, refund_amount, refunded_at
        `)
        .eq('client_id', clientId)
        .eq('is_deleted', false);
      if (search) {
        q = q.or(`job_title.ilike.%${search}%,venue_city.ilike.%${search}%,venue_postcode.ilike.%${search}%`);
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'posted') q = q.in('status', ['open', 'posted']);
        else if (statusFilter === 'awaiting_payment') q = q.in('payment_status', ['pending', 'awaiting_payment']);
        else if (statusFilter === 'funded') q = q.in('payment_status', ['funded', 'paid']);
        else if (statusFilter === 'in_progress') q = q.in('status', ['in_progress', 'active']);
        else if (statusFilter === 'completed') q = q.eq('status', 'completed');
        else if (statusFilter === 'disputed') q = q.eq('disputed', true);
        else if (statusFilter === 'refunded') q = q.not('refunded_at', 'is', null);
        else if (statusFilter === 'cancelled') q = q.eq('status', 'cancelled');
      }
      if (paymentFilter !== 'all') q = q.eq('payment_status', paymentFilter);
      if (dateFrom) q = q.gte('start_date', dateFrom);
      if (dateTo) q = q.lte('start_date', dateTo);
      q = q.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
      return q;
    }

    let totalCount: number;
    let jobsData: any[];

    if (guardSearch) {
      const { data: allJobRows, error: countErr } = await buildCountQuery();
      if (countErr) throw countErr;
      const allIds = (allJobRows || []).map((j: any) => j.id);

      let guardMatchSet = new Set<string>();
      if (allIds.length > 0) {
        const [assignRes, appRes] = await Promise.all([
          supabase.from('job_assignments')
            .select('job_id, guards!inner(full_name)')
            .in('job_id', allIds)
            .ilike('guards.full_name', `%${guardSearch}%`),
          supabase.from('job_applications')
            .select('job_id, guards!inner(full_name)')
            .in('job_id', allIds)
            .ilike('guards.full_name', `%${guardSearch}%`),
        ]);
        (assignRes.data || []).forEach((a: any) => guardMatchSet.add(a.job_id));
        (appRes.data || []).forEach((a: any) => guardMatchSet.add(a.job_id));
      }

      const matchedIds = Array.from(guardMatchSet);
      totalCount = matchedIds.length;
      const pageIds = matchedIds.slice(offset, offset + pageSize);

      if (pageIds.length > 0) {
        const { data } = await supabase
          .from('jobs')
          .select(`
            id, job_title, venue_city, venue_postcode,
            start_date, end_date, start_time, end_time,
            hourly_rate, agreed_amount, number_of_guards,
            status, payment_status, stripe_payment_intent_id,
            platform_fee, guard_payout_amount,
            created_at, updated_at, applications_count, assigned_count,
            disputed, disputed_at, disputed_reason, is_deleted,
            cancelled_at, refund_amount, refunded_at
          `)
          .in('id', pageIds)
          .order('created_at', { ascending: false });
        jobsData = data || [];
      } else {
        jobsData = [];
      }
    } else {
      const [countResult, dataResult] = await Promise.all([
        buildCountQuery(),
        buildDataQuery(),
      ]);
      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;
      totalCount = countResult.count || 0;
      jobsData = dataResult.data || [];
    }

    const currentJobIds = jobsData.map((j: any) => j.id);

    let assignments: any[] = [], applications: any[] = [], completionRequests: any[] = [];
    let disputes: any[] = [], reviews: any[] = [], clientReviews: any[] = [];
    let auditLogs: any[] = [], transactions: any[] = [];

    if (currentJobIds.length > 0) {
      const results = await Promise.all([
        supabase.from('job_assignments').select('id, job_id, guard_id, status, payment_status, payment_amount, assigned_at, completed_at, check_in_time, check_out_time, attendance_status, late_minutes, issue_reported, payout_released, payout_released_at, guards (id, full_name, profile_image_url, rating)').in('job_id', currentJobIds).order('assigned_at', { ascending: false }),
        supabase.from('job_applications').select('id, job_id, guard_id, status, applied_at, guards (id, full_name, profile_image_url, rating)').in('job_id', currentJobIds).order('applied_at', { ascending: false }),
        supabase.from('job_completion_requests').select('id, job_id, guard_id, status, requested_at, client_approved_at, client_disputed_at, dispute_reason, admin_approved_at, notes').in('job_id', currentJobIds).order('requested_at', { ascending: false }),
        supabase.from('disputes').select('id, job_id, guard_id, status, reason, details, resolution, refund_amount, admin_notes, stripe_refund_id, created_at, resolved_at').in('job_id', currentJobIds).order('created_at', { ascending: false }),
        supabase.from('reviews').select('id, job_id, guard_id, rating, punctuality_rating, professionalism_rating, communication_rating, comment, created_at, guards (full_name)').eq('client_id', user.id).in('job_id', currentJobIds).order('created_at', { ascending: false }),
        supabase.from('client_reviews').select('id, job_id, guard_id, rating, comment, created_at, guards (full_name)').eq('client_id', clientId).in('job_id', currentJobIds).order('created_at', { ascending: false }),
        supabase.from('payment_audit_logs').select('id, job_id, assignment_id, guard_id, from_status, to_status, changed_by_role, reason, stripe_event_id, created_at').eq('client_id', clientId).in('job_id', currentJobIds).order('created_at', { ascending: false }).limit(200),
        supabase.from('transactions').select('id, job_id, amount, status, stripe_payment_intent_id, stripe_invoice_id, receipt_url, created_at').eq('client_id', clientId).in('job_id', currentJobIds).order('created_at', { ascending: false }),
      ]);

      assignments = results[0].data || [];
      applications = results[1].data || [];
      completionRequests = results[2].data || [];
      disputes = results[3].data || [];
      reviews = results[4].data || [];
      clientReviews = results[5].data || [];
      auditLogs = results[6].data || [];
      transactions = results[7].data || [];
    }

    const jobMap = new Map();
    jobsData.forEach((job: any) => {
      jobMap.set(job.id, {
        job_id: job.id, job_title: job.job_title,
        venue_city: job.venue_city || '', venue_postcode: job.venue_postcode || '',
        start_date: job.start_date, end_date: job.end_date,
        start_time: job.start_time, end_time: job.end_time,
        hourly_rate: job.hourly_rate, agreed_amount: job.agreed_amount,
        number_of_guards: job.number_of_guards,
        job_status: job.status, payment_status: job.payment_status,
        stripe_payment_intent_id: job.stripe_payment_intent_id,
        platform_fee: job.platform_fee, guard_payout_amount: job.guard_payout_amount,
        created_at: job.created_at, updated_at: job.updated_at,
        applications_count: job.applications_count || 0,
        assigned_count: job.assigned_count || 0,
        disputed: job.disputed, disputed_at: job.disputed_at,
        disputed_reason: job.disputed_reason,
        cancelled_at: job.cancelled_at,
        refund_amount: job.refund_amount, refunded_at: job.refunded_at,
        guards: [], applications: [], completion_requests: [],
        disputes: [], reviews: [], client_reviews: [],
        audit_logs: [], transactions: [],
      });
    });

    assignments.forEach((ass: any) => {
      const e = jobMap.get(ass.job_id);
      if (e) e.guards.push({
        id: ass.guard_id, assignment_id: ass.id,
        full_name: ass.guards?.full_name || 'Unknown',
        profile_image_url: ass.guards?.profile_image_url,
        rating: ass.guards?.rating, status: ass.status,
        payment_status: ass.payment_status, payment_amount: ass.payment_amount,
        assigned_at: ass.assigned_at, completed_at: ass.completed_at,
        check_in_time: ass.check_in_time, check_out_time: ass.check_out_time,
        attendance_status: ass.attendance_status, late_minutes: ass.late_minutes,
        issue_reported: ass.issue_reported,
        payout_released: ass.payout_released, payout_released_at: ass.payout_released_at,
      });
    });

    applications.forEach((app: any) => {
      const e = jobMap.get(app.job_id);
      if (e) e.applications.push({
        id: app.id, guard_id: app.guard_id,
        full_name: app.guards?.full_name || 'Unknown',
        profile_image_url: app.guards?.profile_image_url,
        rating: app.guards?.rating, status: app.status, applied_at: app.applied_at,
      });
    });

    completionRequests.forEach((req: any) => {
      const e = jobMap.get(req.job_id);
      if (e) e.completion_requests.push({
        id: req.id, guard_id: req.guard_id, status: req.status,
        requested_at: req.requested_at, client_approved_at: req.client_approved_at,
        client_disputed_at: req.client_disputed_at, dispute_reason: req.dispute_reason,
        admin_approved_at: req.admin_approved_at, notes: req.notes,
      });
    });

    disputes.forEach((d: any) => {
      const e = jobMap.get(d.job_id);
      if (e) e.disputes.push({
        id: d.id, guard_id: d.guard_id, status: d.status,
        reason: d.reason, details: d.details, resolution: d.resolution,
        refund_amount: d.refund_amount, admin_notes: d.admin_notes,
        stripe_refund_id: d.stripe_refund_id,
        created_at: d.created_at, resolved_at: d.resolved_at,
      });
    });

    reviews.forEach((r: any) => {
      const e = jobMap.get(r.job_id);
      if (e) e.reviews.push({
        id: r.id, guard_id: r.guard_id,
        guard_name: r.guards?.full_name || 'Unknown',
        rating: r.rating, punctuality_rating: r.punctuality_rating,
        professionalism_rating: r.professionalism_rating,
        communication_rating: r.communication_rating,
        comment: r.comment, created_at: r.created_at,
      });
    });

    clientReviews.forEach((r: any) => {
      const e = jobMap.get(r.job_id);
      if (e) e.client_reviews.push({
        id: r.id, guard_id: r.guard_id,
        guard_name: r.guards?.full_name || 'Unknown',
        rating: r.rating, comment: r.comment, created_at: r.created_at,
      });
    });

    auditLogs.forEach((log: any) => {
      const e = jobMap.get(log.job_id);
      if (e) e.audit_logs.push({
        id: log.id, assignment_id: log.assignment_id, guard_id: log.guard_id,
        from_status: log.from_status, to_status: log.to_status,
        changed_by_role: log.changed_by_role,
        reason: log.reason, stripe_event_id: log.stripe_event_id,
        created_at: log.created_at,
      });
    });

    transactions.forEach((t: any) => {
      const e = jobMap.get(t.job_id);
      if (e) e.transactions.push({
        id: t.id, amount: t.amount, status: t.status,
        stripe_payment_intent_id: t.stripe_payment_intent_id,
        stripe_invoice_id: t.stripe_invoice_id,
        receipt_url: t.receipt_url, created_at: t.created_at,
      });
    });

    const jobs = Array.from(jobMap.values());

    return new Response(
      JSON.stringify({
        client: { id: client.id, company_name: client.company_name, total_spent: client.total_spent },
        jobs,
        totalCount,
        page,
        pageSize,
        stats: {
          total_posted: totalCount,
          total_with_applicants: jobs.filter((j: any) => j.applications.length > 0).length,
          total_hired: jobs.filter((j: any) => j.guards.length > 0).length,
          awaiting_payment: jobs.filter((j: any) => j.payment_status === 'pending' || j.payment_status === 'awaiting_payment').length,
          funded: jobs.filter((j: any) => j.payment_status === 'funded' || j.payment_status === 'paid').length,
          in_progress: jobs.filter((j: any) => j.job_status === 'in_progress' || j.job_status === 'active').length,
          awaiting_approval: jobs.filter((j: any) => j.completion_requests.some((r: any) => r.status === 'pending')).length,
          approved_and_paid: jobs.filter((j: any) => j.guards.some((g: any) => g.payout_released)).length,
          disputed: jobs.filter((j: any) => j.disputed || j.disputes.some((d: any) => d.status === 'open' || d.status === 'under_review')).length,
          refunded: jobs.filter((j: any) => j.refund_amount || j.refunded_at || j.transactions.some((t: any) => t.status === 'refunded')).length,
          total_spent: jobs.reduce((sum: number, j: any) => sum + (j.agreed_amount || j.transactions.reduce((s: number, t: any) => s + (t.amount || 0), 0)), 0),
          completed: jobs.filter((j: any) => j.job_status === 'completed').length,
          cancelled: jobs.filter((j: any) => j.job_status === 'cancelled').length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});