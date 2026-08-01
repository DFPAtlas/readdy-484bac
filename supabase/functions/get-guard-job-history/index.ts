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
    const supabaseApp = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'app' },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseApp.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: guard } = await supabaseApp
      .from('guards')
      .select('id, full_name, stripe_connect_status, total_earnings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) {
      return new Response(JSON.stringify({ error: 'Guard not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const guardId = guard.id;

    const { data: applications } = await supabaseApp
      .from('job_applications')
      .select(`
        id,
        status,
        applied_at,
        cover_message,
        proposed_rate,
        jobs (
          id,
          job_title,
          venue_city,
          venue_postcode,
          start_date,
          end_date,
          start_time,
          end_time,
          hourly_rate,
          agreed_amount,
          status,
          payment_status,
          stripe_payment_intent_id,
          platform_fee,
          guard_payout_amount,
          clients (company_name, first_name, last_name)
        )
      `)
      .eq('guard_id', guardId)
      .order('applied_at', { ascending: false });

    const { data: assignments } = await supabaseApp
      .from('job_assignments')
      .select(`
        id,
        status,
        payment_status,
        payment_amount,
        assigned_at,
        completed_at,
        check_in_time,
        check_out_time,
        attendance_status,
        late_minutes,
        issue_reported,
        payout_released,
        payout_released_at,
        jobs (
          id,
          job_title,
          venue_city,
          venue_postcode,
          start_date,
          end_date,
          start_time,
          end_time,
          hourly_rate,
          agreed_amount,
          status,
          payment_status,
          stripe_payment_intent_id,
          platform_fee,
          guard_payout_amount,
          clients (company_name, first_name, last_name)
        )
      `)
      .eq('guard_id', guardId)
      .order('assigned_at', { ascending: false });

    const { data: completionRequests } = await supabaseApp
      .from('job_completion_requests')
      .select('id, job_id, status, requested_at, client_approved_at, client_disputed_at, dispute_reason, admin_approved_at, notes')
      .eq('guard_id', guardId)
      .order('requested_at', { ascending: false });

    const { data: disputes } = await supabaseApp
      .from('disputes')
      .select('id, job_id, status, reason, details, resolution, refund_amount, created_at, resolved_at')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false });

    const { data: reviews } = await supabaseApp
      .from('reviews')
      .select('id, job_id, client_id, rating, punctuality_rating, professionalism_rating, communication_rating, comment, created_at, clients (company_name)')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false });

    const { data: clientReviews } = await supabaseApp
      .from('client_reviews')
      .select('id, job_id, client_id, rating, comment, created_at')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false });

    const { data: auditLogs } = await supabaseApp
      .from('payment_audit_logs')
      .select('id, job_id, from_status, to_status, changed_by_role, reason, created_at')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: payouts } = await supabaseApp
      .from('guard_payouts')
      .select('id, job_id, amount, status, stripe_transfer_id, created_at, paid_at')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false });

    const jobMap = new Map();

    (applications || []).forEach((app: any) => {
      const jobId = app.jobs?.id;
      if (!jobId) return;
      if (!jobMap.has(jobId)) {
        jobMap.set(jobId, {
          job_id: jobId,
          job_title: app.jobs?.job_title || 'Unknown',
          venue_city: app.jobs?.venue_city || '',
          venue_postcode: app.jobs?.venue_postcode || '',
          start_date: app.jobs?.start_date,
          end_date: app.jobs?.end_date,
          start_time: app.jobs?.start_time,
          end_time: app.jobs?.end_time,
          hourly_rate: app.jobs?.hourly_rate,
          agreed_amount: app.jobs?.agreed_amount,
          client_name: app.jobs?.clients?.company_name || `${app.jobs?.clients?.first_name || ''} ${app.jobs?.clients?.last_name || ''}`.trim(),
          job_status: app.jobs?.status,
          payment_status: app.jobs?.payment_status,
          stripe_payment_intent_id: app.jobs?.stripe_payment_intent_id,
          platform_fee: app.jobs?.platform_fee,
          guard_payout_amount: app.jobs?.guard_payout_amount,
          application_status: app.status,
          applied_at: app.applied_at,
          assignment_status: null,
          assigned_at: null,
          completed_at: null,
          check_in_time: null,
          check_out_time: null,
          attendance_status: null,
          late_minutes: null,
          issue_reported: false,
          payout_released: false,
          payout_released_at: null,
          completion_request_status: null,
          completion_requested_at: null,
          client_approved_at: null,
          dispute_status: null,
          dispute_reason: null,
          dispute_created_at: null,
          review: null,
          client_review: null,
          audit_logs: [],
          payout: null,
        });
      } else {
        const entry = jobMap.get(jobId);
        entry.application_status = app.status;
        entry.applied_at = app.applied_at;
      }
    });

    (assignments || []).forEach((ass: any) => {
      const jobId = ass.jobs?.id;
      if (!jobId) return;
      if (jobMap.has(jobId)) {
        const entry = jobMap.get(jobId);
        entry.assignment_status = ass.status;
        entry.assigned_at = ass.assigned_at;
        entry.completed_at = ass.completed_at;
        entry.check_in_time = ass.check_in_time;
        entry.check_out_time = ass.check_out_time;
        entry.attendance_status = ass.attendance_status;
        entry.late_minutes = ass.late_minutes;
        entry.issue_reported = ass.issue_reported;
        entry.payout_released = ass.payout_released;
        entry.payout_released_at = ass.payout_released_at;
        entry.payment_status = ass.payment_status || entry.payment_status;
      } else {
        jobMap.set(jobId, {
          job_id: jobId,
          job_title: ass.jobs?.job_title || 'Unknown',
          venue_city: ass.jobs?.venue_city || '',
          venue_postcode: ass.jobs?.venue_postcode || '',
          start_date: ass.jobs?.start_date,
          end_date: ass.jobs?.end_date,
          start_time: ass.jobs?.start_time,
          end_time: ass.jobs?.end_time,
          hourly_rate: ass.jobs?.hourly_rate,
          agreed_amount: ass.jobs?.agreed_amount,
          client_name: ass.jobs?.clients?.company_name || `${ass.jobs?.clients?.first_name || ''} ${ass.jobs?.clients?.last_name || ''}`.trim(),
          job_status: ass.jobs?.status,
          payment_status: ass.jobs?.payment_status,
          stripe_payment_intent_id: ass.jobs?.stripe_payment_intent_id,
          platform_fee: ass.jobs?.platform_fee,
          guard_payout_amount: ass.jobs?.guard_payout_amount,
          application_status: null,
          applied_at: null,
          assignment_status: ass.status,
          assigned_at: ass.assigned_at,
          completed_at: ass.completed_at,
          check_in_time: ass.check_in_time,
          check_out_time: ass.check_out_time,
          attendance_status: ass.attendance_status,
          late_minutes: ass.late_minutes,
          issue_reported: ass.issue_reported,
          payout_released: ass.payout_released,
          payout_released_at: ass.payout_released_at,
          completion_request_status: null,
          completion_requested_at: null,
          client_approved_at: null,
          dispute_status: null,
          dispute_reason: null,
          dispute_created_at: null,
          review: null,
          client_review: null,
          audit_logs: [],
          payout: null,
        });
      }
    });

    (completionRequests || []).forEach((req: any) => {
      const entry = jobMap.get(req.job_id);
      if (entry) {
        entry.completion_request_status = req.status;
        entry.completion_requested_at = req.requested_at;
        entry.client_approved_at = req.client_approved_at;
        entry.dispute_reason = req.dispute_reason;
      }
    });

    (disputes || []).forEach((d: any) => {
      const entry = jobMap.get(d.job_id);
      if (entry) {
        entry.dispute_status = d.status;
        entry.dispute_reason = d.reason || d.details;
        entry.dispute_created_at = d.created_at;
      }
    });

    (reviews || []).forEach((r: any) => {
      const entry = jobMap.get(r.job_id);
      if (entry) {
        entry.review = {
          id: r.id,
          rating: r.rating,
          punctuality_rating: r.punctuality_rating,
          professionalism_rating: r.professionalism_rating,
          communication_rating: r.communication_rating,
          comment: r.comment,
          created_at: r.created_at,
          client_name: r.clients?.company_name || 'Client',
        };
      }
    });

    (clientReviews || []).forEach((r: any) => {
      const entry = jobMap.get(r.job_id);
      if (entry) {
        entry.client_review = {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
        };
      }
    });

    (auditLogs || []).forEach((log: any) => {
      const entry = jobMap.get(log.job_id);
      if (entry) {
        entry.audit_logs.push({
          id: log.id,
          from_status: log.from_status,
          to_status: log.to_status,
          changed_by_role: log.changed_by_role,
          reason: log.reason,
          created_at: log.created_at,
        });
      }
    });

    (payouts || []).forEach((p: any) => {
      const entry = jobMap.get(p.job_id);
      if (entry) {
        entry.payout = {
          id: p.id,
          amount: p.amount,
          status: p.status,
          stripe_transfer_id: p.stripe_transfer_id,
          created_at: p.created_at,
          paid_at: p.paid_at,
        };
      }
    });

    const jobs = Array.from(jobMap.values()).sort((a: any, b: any) => {
      const aDate = a.assigned_at || a.applied_at || a.start_date || '';
      const bDate = b.assigned_at || b.applied_at || b.start_date || '';
      return bDate.localeCompare(aDate);
    });

    const totalApplied = applications?.length || 0;
    const totalAccepted = applications?.filter((a: any) => a.status === 'accepted' || a.status === 'confirmed').length || 0;
    const totalFunded = jobs.filter((j: any) => j.payment_status === 'funded' || j.payment_status === 'paid').length;
    const totalCompleted = jobs.filter((j: any) => j.assignment_status === 'completed').length;
    const totalPendingApproval = jobs.filter((j: any) => j.completion_request_status === 'pending').length;
    const totalPaidOut = jobs.filter((j: any) => j.payout_released || j.payout?.status === 'paid').length;
    const totalDisputed = jobs.filter((j: any) => j.dispute_status === 'open' || j.dispute_status === 'under_review').length;
    const totalCancelled = jobs.filter((j: any) => j.job_status === 'cancelled').length;
    const totalEarned = jobs.reduce((sum: number, j: any) => sum + (j.payout?.amount || j.guard_payout_amount || j.payment_amount || 0), 0);
    const pendingPayout = jobs.filter((j: any) => j.assignment_status === 'completed' && !j.payout_released && !j.dispute_status)
      .reduce((sum: number, j: any) => sum + (j.guard_payout_amount || j.payment_amount || 0), 0);
    const releasedPayout = jobs.filter((j: any) => j.payout_released || j.payout?.status === 'paid')
      .reduce((sum: number, j: any) => sum + (j.payout?.amount || j.guard_payout_amount || j.payment_amount || 0), 0);

    return new Response(
      JSON.stringify({
        guard: {
          id: guard.id,
          full_name: guard.full_name,
          stripe_connect_status: guard.stripe_connect_status,
          total_earnings: guard.total_earnings,
        },
        jobs,
        stats: {
          total_applied: totalApplied,
          total_accepted: totalAccepted,
          total_funded: totalFunded,
          total_completed: totalCompleted,
          total_pending_approval: totalPendingApproval,
          total_paid_out: totalPaidOut,
          total_disputed: totalDisputed,
          total_cancelled: totalCancelled,
          total_earned: totalEarned,
          pending_payout: pendingPayout,
          released_payout: releasedPayout,
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
