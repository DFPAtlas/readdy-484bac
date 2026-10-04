import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const allowed = ['https://quickguard.uk', 'https://www.quickguard.uk'];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', {headers});
  const respond = (body: any, status: number) => new Response(JSON.stringify(body), {status, headers});
  if (req.method !== 'POST') return respond({error: 'Method not allowed'}, 405);
  const body = await req.json().catch(() => null);
  if (!body?.jobId || !body?.assignmentId) return respond({error: 'Job and assignment IDs are required'}, 400);
  const { jobId, assignmentId, notes } = body;

  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'app' } }
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return respond({ error: 'Unauthorized' }, 401);

  const { data: guard } = await supabase.from('guards').select('id').eq('user_id', user.id).maybeSingle();
  if (!guard) return respond({ error: 'Guard not found' }, 404);

  const { data: assignment } = await supabase
    .from('job_assignments')
    .select('id, job_id, guard_id, status, payment_status, check_in_time, check_out_time, issue_reported, replacement_requested')
    .eq('id', assignmentId)
    .eq('guard_id', guard.id)
    .maybeSingle();
  if (!assignment) return respond({ error: 'Assignment not found' }, 404);

  if (assignment.job_id !== jobId) {
    return respond({ error: 'Assignment does not belong to this job' }, 403);
  }

  if (assignment.status !== 'in_progress') {
    return respond({ error: 'You must check in before marking complete' }, 400);
  }

  if (!assignment.check_in_time) {
    return respond({ error: 'You must check in before marking complete' }, 400);
  }

  if (!assignment.check_out_time) {
    return respond({ error: 'You must check out before marking complete' }, 400);
  }

  if (assignment.issue_reported || assignment.replacement_requested) {
    return respond({ error: 'An issue or replacement request is open for this shift. Please resolve it before marking complete.' }, 409);
  }

  const { data: job } = await supabase.from('jobs').select('payment_status, client_id, job_title, disputed').eq('id', jobId).maybeSingle();
  if (!job) return respond({ error: 'Job not found' }, 404);

  if (job.payment_status !== 'funded') {
    return respond({ error: 'Job must be funded before marking complete' }, 400);
  }

  if (job.disputed) {
    return respond({ error: 'This job has an open dispute and cannot be marked complete.' }, 409);
  }

  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('job_completion_requests')
    .select('id, status')
    .eq('job_id', jobId)
    .eq('guard_id', guard.id)
    .maybeSingle();

  if (existing && existing.status !== 'rejected') {
    return respond({ error: 'Completion request already exists' }, 409);
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
    return respond({ error: insertError.message }, 500);
  }

  const { error: assignmentUpdateError } = await supabase.from('job_assignments').update({
    status: 'completed',
    completed_at: now,
    updated_at: now,
  }).eq('id', assignmentId).eq('job_id', jobId).eq('guard_id', guard.id);

  if (assignmentUpdateError) {
    await supabase.from('job_completion_requests').delete().eq('id', request.id);
    return respond({ error: 'Failed to update assignment completion state' }, 500);
  }

  const { error: jobUpdateError } = await supabase.from('jobs').update({
    status: 'awaiting_client_approval',
    updated_at: now,
  }).eq('id', jobId);

  if (jobUpdateError) {
    await supabase.from('job_assignments').update({
      status: 'in_progress',
      completed_at: null,
      updated_at: now,
    }).eq('id', assignmentId).eq('job_id', jobId).eq('guard_id', guard.id);
    await supabase.from('job_completion_requests').delete().eq('id', request.id);
    return respond({ error: 'Failed to update job completion state' }, 500);
  }

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

  return respond({ success: true, requestId: request.id }, 200);
});
