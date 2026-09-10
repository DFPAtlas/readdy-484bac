import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && CORS_ORIGINS.includes(origin) ? origin : 'https://quickguard.uk',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function json(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

async function notifyClient(supabase: any, clientId: string, guardName: string, jobTitle: string, lateMinutes: number | null, action: string) {
  try {
    const { data: client } = await supabase.from('clients').select('user_id').eq('id', clientId).maybeSingle();
    if (!client?.user_id) return;
    const isLate = !!lateMinutes && lateMinutes > 0;
    const title = action === 'check_in' ? (isLate ? 'Guard Checked In (Late)' : 'Guard Checked In') : 'Guard Checked Out';
    const message = action === 'check_in'
      ? `${guardName} ${isLate ? `checked in ${lateMinutes} minutes late` : 'checked in'} for "${jobTitle}".`
      : `${guardName} checked out for "${jobTitle}".`;
    await supabase.from('notifications').insert({
      user_id: client.user_id,
      user_type: 'client',
      title,
      message,
      type: action === 'check_in' ? (isLate ? 'warning' : 'success') : 'success',
      is_read: false,
      link: '/client/dashboard',
      created_at: new Date().toISOString(),
    });
  } catch {
    // non-blocking
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(origin, 405, { error: 'Method not allowed' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'app' } }
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return json(origin, 401, { error: 'Authentication required' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json(origin, 401, { error: 'Authentication required' });

  let body: { action?: string; assignmentId?: string; jobId?: string };
  try { body = await req.json(); } catch { return json(origin, 400, { error: 'Invalid request body' }); }

  const action = body.action;
  const assignmentId = body.assignmentId;
  const jobId = body.jobId;

  if (!action || !['check_in', 'check_out'].includes(action)) return json(origin, 400, { error: 'Invalid action' });
  if (!assignmentId || !jobId) return json(origin, 400, { error: 'Missing assignmentId or jobId' });

  const { data: guard } = await supabase.from('guards').select('id, full_name').eq('user_id', user.id).maybeSingle();
  if (!guard) return json(origin, 404, { error: 'Guard profile not found' });

  const { data: assignment } = await supabase
    .from('job_assignments')
    .select('id, job_id, guard_id, status, payment_status, check_in_time, check_out_time, issue_reported, replacement_requested')
    .eq('id', assignmentId)
    .eq('guard_id', guard.id)
    .maybeSingle();

  if (!assignment) return json(origin, 404, { error: 'Assignment not found or does not belong to you' });
  if (assignment.job_id !== jobId) return json(origin, 400, { error: 'Assignment does not match this job' });

  const { data: job } = await supabase
    .from('jobs')
    .select('id, client_id, job_title, status, payment_status, start_date, start_time, disputed')
    .eq('id', jobId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!job) return json(origin, 404, { error: 'Job not found' });

  const now = new Date().toISOString();
  const jobCancelledOrRefunded = ['cancelled', 'refunded'].includes(job.status) || ['cancelled', 'refunded'].includes(job.payment_status || '');

  if (action === 'check_in') {
    if (assignment.status !== 'confirmed') return json(origin, 400, { error: 'This shift is not confirmed yet' });
    if (assignment.payment_status !== 'funded' || job.payment_status !== 'funded') return json(origin, 400, { error: 'This shift has not been funded yet' });
    if (!['confirmed', 'in_progress'].includes(job.status)) return json(origin, 400, { error: 'This job is not active' });
    if (jobCancelledOrRefunded) return json(origin, 400, { error: 'This job has been cancelled or refunded' });
    if (assignment.check_in_time) return json(origin, 409, { error: 'You have already checked in' });

    let lateMinutes = 0;
    try {
      const shiftStart = new Date(`${job.start_date}T${job.start_time || '00:00:00'}`);
      const diffMs = Date.now() - shiftStart.getTime();
      if (diffMs > 0) lateMinutes = Math.floor(diffMs / 60000);
    } catch {
      lateMinutes = 0;
    }

    const { error: updateErr } = await supabase.from('job_assignments').update({
      status: 'in_progress',
      attendance_status: 'checked_in',
      check_in_time: now,
      late_minutes: lateMinutes,
      updated_at: now,
    }).eq('id', assignmentId);

    if (updateErr) return json(origin, 500, { error: 'Failed to record check-in' });

    await supabase.from('jobs').update({ status: 'in_progress', updated_at: now }).eq('id', jobId);

    await supabase.from('payment_audit_logs').insert({
      job_id: jobId,
      assignment_id: assignmentId,
      guard_id: guard.id,
      client_id: job.client_id,
      from_status: 'confirmed',
      to_status: 'in_progress',
      changed_by: user.id,
      changed_by_role: 'guard',
      reason: lateMinutes > 0 ? `Guard checked in ${lateMinutes} min late` : 'Guard checked in',
      created_at: now,
    });

    await notifyClient(supabase, job.client_id, guard.full_name || 'A guard', job.job_title || 'the job', lateMinutes, 'check_in');

    return json(origin, 200, { success: true, action: 'check_in', check_in_time: now, late_minutes: lateMinutes });
  }

  if (!assignment.check_in_time) return json(origin, 400, { error: 'You must check in before checking out' });
  if (assignment.check_out_time) return json(origin, 409, { error: 'You have already checked out' });

  const { error: updateErr } = await supabase.from('job_assignments').update({
    attendance_status: 'checked_out',
    check_out_time: now,
    updated_at: now,
  }).eq('id', assignmentId);

  if (updateErr) return json(origin, 500, { error: 'Failed to record check-out' });

  await supabase.from('payment_audit_logs').insert({
    job_id: jobId,
    assignment_id: assignmentId,
    guard_id: guard.id,
    client_id: job.client_id,
    from_status: 'in_progress',
    to_status: 'in_progress',
    changed_by: user.id,
    changed_by_role: 'guard',
    reason: 'Guard checked out',
    created_at: now,
  });

  await notifyClient(supabase, job.client_id, guard.full_name || 'A guard', job.job_title || 'the job', null, 'check_out');

  return json(origin, 200, { success: true, action: 'check_out', check_out_time: now });
});
