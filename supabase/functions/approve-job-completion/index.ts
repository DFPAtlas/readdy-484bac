import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const { requestId, action, disputeReason, review } = await req.json();

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
  const isClient = !!client;
  const isAdmin = !!admin;
  if (!isClient && !isAdmin) return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });

  const { data: request } = await supabase
    .from('job_completion_requests')
    .select('id, job_id, guard_id, client_id, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!request) return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });

  if (request.status !== 'pending') {
    return new Response(JSON.stringify({ error: 'Request already processed' }), { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: guardData } = await supabase.from('guards').select('user_id, full_name').eq('id', request.guard_id).maybeSingle();
  const { data: jobData } = await supabase.from('jobs').select('job_title, payment_status').eq('id', request.job_id).maybeSingle();
  const guardName = guardData?.full_name || 'Guard';
  const jobTitle = jobData?.job_title || 'the job';

  if (action === 'approve') {
    await supabase.from('job_completion_requests').update({
      status: 'approved',
      client_approved_at: now,
      updated_at: now,
    }).eq('id', requestId);

    await supabase.from('job_assignments').update({
      payment_status: 'client_released',
      updated_at: now,
    }).eq('job_id', request.job_id).eq('guard_id', request.guard_id);

    await supabase.from('jobs').update({
      payment_status: 'client_released',
      completion_status: 'confirmed_by_client',
      updated_at: now,
    }).eq('id', request.job_id);

    await supabase.from('payment_audit_logs').insert({
      job_id: request.job_id,
      guard_id: request.guard_id,
      client_id: request.client_id,
      from_status: 'awaiting_client_release',
      to_status: 'client_released',
      changed_by: user.id,
      changed_by_role: isAdmin ? 'admin' : 'client',
      reason: 'Client approved completion — payout can now be released',
    });

    if (guardData?.user_id) {
      await supabase.from('notifications').insert({
        user_id: guardData.user_id,
        user_type: 'guard',
        title: 'Completion Approved — Payment Released',
        message: `Completion for "${jobTitle}" has been approved. Your payout is now queued for release.`,
        type: 'success',
        is_read: false,
        link: `/guard/dashboard#earnings`,
        data: { job_id: request.job_id },
        created_at: now,
      });
    }

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('id, guard_net_payout, guard_id')
      .eq('job_id', request.job_id)
      .eq('guard_id', request.guard_id)
      .maybeSingle();

    if (assignment) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        await fetch(`${supabaseUrl}/functions/v1/release-guard-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            assignmentId: assignment.id,
            jobId: request.job_id,
            guardId: request.guard_id,
            amount: assignment.guard_net_payout || 0,
            jobTitle,
            guardEmail: null,
            guardName: guardName,
            adminNotes: 'Auto-released on client approval',
            completionRequestId: requestId,
            triggeredBy: isAdmin ? 'admin' : 'client',
          }),
        });
      } catch (payoutErr: any) {
        console.error('[approve-job-completion] Payout trigger failed:', payoutErr.message);
      }
    }

    if (review) {
      await supabase.from('reviews').insert({
        job_id: request.job_id,
        guard_id: request.guard_id,
        client_id: request.client_id,
        rating: review.rating,
        punctuality: review.punctuality_rating,
        professionalism: review.professionalism_rating,
        communication: review.communication_rating,
        review_text: review.comment,
        status: 'published',
        created_at: now,
      });
    }
  } else if (action === 'dispute') {
    await supabase.from('job_completion_requests').update({
      status: 'disputed',
      client_disputed_at: now,
      dispute_reason: disputeReason || 'No reason provided',
      updated_at: now,
    }).eq('id', requestId);

    await supabase.from('job_assignments').update({
      payment_status: 'disputed',
      updated_at: now,
    }).eq('job_id', request.job_id).eq('guard_id', request.guard_id);

    await supabase.from('jobs').update({
      payment_status: 'disputed',
      disputed: true,
      disputed_at: now,
      disputed_reason: disputeReason || 'No reason provided',
      updated_at: now,
    }).eq('id', request.job_id);

    await supabase.from('payment_audit_logs').insert({
      job_id: request.job_id,
      guard_id: request.guard_id,
      client_id: request.client_id,
      from_status: 'awaiting_client_release',
      to_status: 'disputed',
      changed_by: user.id,
      changed_by_role: isAdmin ? 'admin' : 'client',
      reason: disputeReason || 'Client disputed job completion',
    });

    if (guardData?.user_id) {
      await supabase.from('notifications').insert({
        user_id: guardData.user_id,
        user_type: 'guard',
        title: 'Completion Disputed',
        message: `The client has disputed your completion for "${jobTitle}". Reason: ${disputeReason || 'No reason provided'}`,
        type: 'error',
        is_read: false,
        link: `/guard/dashboard`,
        data: { job_id: request.job_id },
        created_at: now,
      });
    }
  } else if (action === 'admin_approve') {
    await supabase.from('job_completion_requests').update({
      status: 'approved',
      admin_approved_at: now,
      admin_approved_by: admin.id,
      updated_at: now,
    }).eq('id', requestId);

    await supabase.from('job_assignments').update({
      payment_status: 'client_released',
      updated_at: now,
    }).eq('job_id', request.job_id).eq('guard_id', request.guard_id);

    await supabase.from('jobs').update({
      payment_status: 'client_released',
      completion_status: 'confirmed_by_admin',
      updated_at: now,
    }).eq('id', request.job_id);

    await supabase.from('payment_audit_logs').insert({
      job_id: request.job_id,
      guard_id: request.guard_id,
      client_id: request.client_id,
      from_status: 'disputed',
      to_status: 'client_released',
      changed_by: user.id,
      changed_by_role: 'admin',
      reason: 'Admin approved and released payment',
    });

    if (guardData?.user_id) {
      await supabase.from('notifications').insert({
        user_id: guardData.user_id,
        user_type: 'guard',
        title: 'Payment Released by Admin',
        message: `An admin has approved completion for "${jobTitle}". Payment has been released.`,
        type: 'success',
        is_read: false,
        link: `/guard/dashboard#earnings`,
        data: { job_id: request.job_id },
        created_at: now,
      });
    }

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('id, guard_net_payout, guard_id')
      .eq('job_id', request.job_id)
      .eq('guard_id', request.guard_id)
      .maybeSingle();

    if (assignment) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        await fetch(`${supabaseUrl}/functions/v1/release-guard-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            assignmentId: assignment.id,
            jobId: request.job_id,
            guardId: request.guard_id,
            amount: assignment.guard_net_payout || 0,
            jobTitle,
            guardEmail: null,
            guardName: guardName,
            adminNotes: 'Admin approved release',
            completionRequestId: requestId,
            triggeredBy: 'admin',
          }),
        });
      } catch (payoutErr: any) {
        console.error('[approve-job-completion] Payout trigger failed:', payoutErr.message);
      }
    }
  } else {
    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
