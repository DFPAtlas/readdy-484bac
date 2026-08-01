import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const { jobId, assignmentId, notes } = await req.json();

  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'app' }, global: { headers: { Authorization: authHeader || '' } } }
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { data: guard } = await supabase.from('guards').select('id').eq('user_id', user.id).maybeSingle();
  if (!guard) return new Response(JSON.stringify({ error: 'Guard not found' }), { status: 404 });

  const { data: assignment } = await supabase
    .from('job_assignments')
    .select('id, job_id, guard_id, status, payment_status')
    .eq('id', assignmentId)
    .eq('guard_id', guard.id)
    .maybeSingle();
  if (!assignment) return new Response(JSON.stringify({ error: 'Assignment not found' }), { status: 404 });

  if (assignment.status !== 'in_progress') {
    return new Response(JSON.stringify({ error: 'You must check in before marking complete' }), { status: 400 });
  }

  const { data: job } = await supabase.from('jobs').select('payment_status, client_id, job_title').eq('id', jobId).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });

  if (job.payment_status !== 'funded') {
    return new Response(JSON.stringify({ error: 'Job must be funded before marking complete' }), { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('job_completion_requests')
    .select('id, status')
    .eq('job_id', jobId)
    .eq('guard_id', guard.id)
    .maybeSingle();

  if (existing && existing.status !== 'rejected') {
    return new Response(JSON.stringify({ error: 'Completion request already exists' }), { status: 409 });
  }

  const { data: request, error: insertError } = await supabase
    .from('job_completion_requests')
    .insert({
      job_id: jobId,
      guard_id: guard.id,
      client_id: job.client_id,
      status: 'pending',
      requested_at: now,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  await supabase.from('job_assignments').update({
    status: 'completed',
    payment_status: 'awaiting_client_release',
    completed_at: now,
    check_out_time: now,
    updated_at: now,
  }).eq('id', assignmentId);

  await supabase.from('jobs').update({
    status: 'awaiting_client_confirmation',
    payment_status: 'awaiting_client_release',
    updated_at: now,
  }).eq('id', jobId);

  await supabase.from('payment_audit_logs').insert({
    job_id: jobId,
    assignment_id: assignmentId,
    guard_id: guard.id,
    client_id: job.client_id,
    from_status: 'funded',
    to_status: 'awaiting_client_release',
    changed_by: user.id,
    changed_by_role: 'guard',
    reason: 'Guard marked job complete — awaiting client release',
  });

  try {
    const { data: guardData } = await supabase.from('guards').select('full_name').eq('id', guard.id).maybeSingle();
    const guardName = guardData?.full_name || 'A guard';
    const { data: clientData } = await supabase.from('clients').select('email, company_name, user_id').eq('id', job.client_id).maybeSingle();

    if (clientData?.user_id) {
      await supabase.from('notifications').insert({
        user_id: clientData.user_id,
        user_type: 'client',
        title: 'Job Marked Complete',
        message: `${guardName} has marked "${job.job_title}" as complete. Please review and approve to release payment.`,
        type: 'warning',
        is_read: false,
        link: `/client/jobs/${jobId}`,
        data: { job_id: jobId, completion_request_id: request.id },
        created_at: now,
      });
    }

    if (clientData?.email) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-job-payment-complete-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          clientEmail: clientData.email,
          clientName: clientData.company_name || 'Client',
          guardName,
          jobTitle: job.job_title || 'Your Job',
          message: 'Your guard has marked the job as complete. Please review and approve the completion to release payment.',
          type: 'completion_request',
        }),
      });
    }
  } catch { /* non-blocking */ }

  return new Response(JSON.stringify({ success: true, requestId: request.id }), { status: 200 });
});