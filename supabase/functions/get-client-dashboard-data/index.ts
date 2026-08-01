import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      {
  auth: { persistSession: false },
  db: { schema: "app" }
}
    );

    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientData) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cid = clientData.id;

    const { data: allJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', cid)
      .order('created_at', { ascending: false });

    const jobsData = allJobs || [];
    const jobIds = jobsData.map(j => j.id);

    const jobStats = {
      total_jobs: jobsData.length,
      active_jobs: jobsData.filter(j => j.status === 'active' || j.status === 'open').length,
      completed_jobs: jobsData.filter(j => j.status === 'completed').length,
      pending_payments: jobsData.filter(j => j.status === 'payment_pending').length,
    };

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const jobsAwaitingPayment = jobsData.filter(j => j.status === 'payment_pending').length;
    const jobsStartingSoon = jobsData.filter(j => {
      if (!j.start_date) return false;
      const d = new Date(j.start_date);
      return d >= now && d <= in48h;
    }).length;

    let guardsAwaitingReview = 0;
    let expiringLicences = 0;
    if (jobIds.length > 0) {
      const { count: appCount } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .in('job_id', jobIds)
        .eq('status', 'pending');
      guardsAwaitingReview = appCount || 0;

      const { data: assignedGuards } = await supabase
        .from('job_assignments')
        .select('guard_id')
        .in('job_id', jobIds);
      const guardIds = [...new Set((assignedGuards || []).map(a => a.guard_id).filter(Boolean))];
      if (guardIds.length > 0) {
        const { count: expCount } = await supabase
          .from('guards')
          .select('*', { count: 'exact', head: true })
          .in('id', guardIds)
          .lte('sia_expiry_date', in30d.toISOString().split('T')[0])
          .gte('sia_expiry_date', now.toISOString().split('T')[0]);
        expiringLicences = expCount || 0;
      }
    }

    const { count: unreadCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);

    const recentJobs = jobsData.slice(0, 5).map(j => ({
      id: j.id,
      job_title: j.job_title,
      venue_city: j.venue_city,
      postcode: j.postcode,
      start_date: j.start_date,
      status: j.status,
      applications_count: j.applications_count || 0,
      assigned_count: j.assigned_count || 0,
      needs_payment: j.status === 'payment_pending',
    }));

    const jobsWithApplications = jobsData.filter(j => (j.applications_count || 0) > 0);
    const jobsWithSelected = jobsData.filter(j => (j.assigned_count || 0) > 0);
    const pipelineData = {
      draftCount: jobsData.filter(j => j.status === 'draft').length,
      postedCount: jobsData.filter(j => j.status === 'open').length,
      applicationsCount: jobsWithApplications.length,
      selectedCount: jobsWithSelected.length,
      paymentPendingCount: jobsAwaitingPayment,
      activeCount: jobsData.filter(j => j.status === 'active').length,
      completedCount: jobsData.filter(j => j.status === 'completed').length,
    };

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: txData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('client_id', cid)
      .gte('created_at', startOfMonth);
    const totalSpend = (txData || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    let totalGuardsHired = 0;
    if (jobIds.length > 0) {
      const { data: distinctGuards } = await supabase
        .from('job_assignments')
        .select('guard_id')
        .in('job_id', jobIds);
      totalGuardsHired = [...new Set((distinctGuards || []).map(a => a.guard_id))].length;
    }

    let avgFill = 0;
    if (jobIds.length > 0) {
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select('assigned_at, job_id')
        .in('job_id', jobIds)
        .order('assigned_at', { ascending: true });
      const fillTimes = [];
      const seenJobs = new Set();
      (assignments || []).forEach(a => {
        if (seenJobs.has(a.job_id)) return;
        const job = jobsData.find(j => j.id === a.job_id);
        if (job && a.assigned_at) {
          const diff = (new Date(a.assigned_at).getTime() - new Date(job.created_at).getTime()) / (1000 * 60 * 60);
          if (diff >= 0) {
            fillTimes.push(diff);
            seenJobs.add(a.job_id);
          }
        }
      });
      avgFill = fillTimes.length > 0 ? Math.round(fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length) : 0;
    }

    const completedThisMonth = jobsData.filter(j => {
      if (j.status !== 'completed') return false;
      if (!j.updated_at) return false;
      return new Date(j.updated_at) >= new Date(startOfMonth);
    }).length;

    const { data: topGuards } = await supabase
      .from('guards')
      .select('id, full_name, sia_licence_number, rating, total_reviews, years_experience, location, profile_image_url')
      .eq('sia_verified', true)
      .eq('is_active', true)
      .order('rating', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      jobStats,
      actionData: {
        guardsAwaitingReview,
        jobsAwaitingPayment,
        jobsStartingSoon,
        unreadMessages: unreadCount || 0,
        expiringLicences,
      },
      recentJobs,
      pipelineData,
      businessData: {
        activeJobs: jobStats.active_jobs,
        totalGuardsHired,
        totalSpendThisMonth: totalSpend,
        averageFillTime: avgFill,
        completedThisMonth,
      },
      recommendedGuards: topGuards || [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});