import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getAal(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

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
  if (getAal(jwt) !== 'aal2') {
    return new Response(JSON.stringify({ error: 'Multi-factor authentication required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { data: adminUser } = await supabase.from('admin_users').select('id, full_name, email, is_active').eq('user_id', user.id).maybeSingle();
  if (!adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const { action } = body;
    const now = new Date().toISOString();
    const adminName = adminUser.full_name || adminUser.email || 'Admin';
    const adminId = adminUser.id;

    if (action === 'delete') {
      const { jobId } = body;
      if (!jobId) throw new Error('jobId required');
      const { data: job } = await supabase.from('jobs').select('id, job_title, clients(company_name, contact_name, email)').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const { error } = await supabase.from('jobs').update({ is_deleted: true, deleted_at: now }).eq('id', jobId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin',
        admin_name: adminName,
        action_type: 'job_deleted',
        action_description: `Deleted job "${job.job_title}" posted by ${(job.clients as any)?.company_name || 'Unknown'}`,
        target_type: 'job',
        target_name: job.job_title,
        metadata: { jobId, adminId },
      });
      try {
        const clientEmail = (job.clients as any)?.email;
        const clientName = (job.clients as any)?.contact_name || (job.clients as any)?.company_name || 'Client';
        if (clientEmail) {
          await fetch(`${supabaseUrl}/functions/v1/send-job-deleted-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ email: clientEmail, name: clientName, job_title: job.job_title, job_id: jobId, deletion_reason: 'This job posting has been removed by the administrator.' }),
          });
        }
      } catch (emailErr: any) {
        console.error('Delete email failed:', emailErr.message);
      }
      return new Response(JSON.stringify({ success: true, message: 'Job deleted' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'status_change') {
      const { jobId, newStatus, note } = body;
      if (!jobId || !newStatus) throw new Error('jobId and newStatus required');
      const { data: job } = await supabase.from('jobs').select('id, job_title, status').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const { error } = await supabase.from('jobs').update({ status: newStatus, updated_at: now }).eq('id', jobId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: 'job_status_changed',
        action_description: `Changed status of "${job.job_title}" from ${job.status} to ${newStatus}${note ? ': ' + note : ''}`,
        target_type: 'job', target_name: job.job_title,
        metadata: { jobId, from: job.status, to: newStatus, note: note || '', adminId },
      });
      return new Response(JSON.stringify({ success: true, message: 'Status updated' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'flag') {
      const { jobId, reason } = body;
      if (!jobId) throw new Error('jobId required');
      const { data: job } = await supabase.from('jobs').select('id, job_title').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const { error } = await supabase.from('jobs').update({ risk_level: reason || 'suspicious', updated_at: now }).eq('id', jobId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: 'job_flagged',
        action_description: `Flagged job "${job.job_title}" as ${reason || 'suspicious'}`,
        target_type: 'job', target_name: job.job_title,
        metadata: { jobId, reason: reason || 'suspicious', adminId },
      });
      return new Response(JSON.stringify({ success: true, message: 'Job flagged' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'unflag') {
      const { jobId } = body;
      if (!jobId) throw new Error('jobId required');
      const { data: job } = await supabase.from('jobs').select('id, job_title').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const { error } = await supabase.from('jobs').update({ risk_level: null, updated_at: now }).eq('id', jobId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: 'job_unflagged',
        action_description: `Removed flag from job "${job.job_title}"`,
        target_type: 'job', target_name: job.job_title,
        metadata: { jobId, adminId },
      });
      return new Response(JSON.stringify({ success: true, message: 'Flag removed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'accept_applicant') {
      const { applicationId, jobId, guardId } = body;
      if (!applicationId || !jobId || !guardId) throw new Error('applicationId, jobId, and guardId required');
      const { data: job } = await supabase.from('jobs').select('id, job_title').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const { data: existingAssign } = await supabase.from('job_assignments').select('id').eq('job_id', jobId).eq('guard_id', guardId).maybeSingle();
      if (existingAssign) {
        return new Response(JSON.stringify({ error: 'Guard is already assigned to this job' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { error: appErr } = await supabase.from('job_applications').update({ status: 'accepted', updated_at: now }).eq('id', applicationId);
      if (appErr) throw appErr;
      const { error: assignErr } = await supabase.from('job_assignments').upsert({ job_id: jobId, guard_id: guardId, status: 'confirmed', assigned_at: now }, { onConflict: 'job_id,guard_id', ignoreDuplicates: false });
      if (assignErr) throw assignErr;
      const { data: guardData } = await supabase.from('guards').select('user_id, full_name').eq('id', guardId).maybeSingle();
      const guardName = guardData?.full_name || 'Guard';
      if (guardData?.user_id) {
        await supabase.from('notifications').insert({
          user_id: guardData.user_id, user_type: 'guard', type: 'application_accepted',
          title: 'Application Accepted',
          message: `Your application for "${job.job_title}" has been accepted. Check your dashboard for details.`,
          link: '/guard/dashboard', is_read: false,
        });
      }
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: 'application_accepted',
        action_description: `Accepted application from ${guardName} for "${job.job_title}"`,
        target_type: 'job_application', target_name: job.job_title,
        metadata: { jobId, guardId, applicationId, adminId },
      });
      return new Response(JSON.stringify({ success: true, message: 'Application accepted' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'decline_applicant') {
      const { applicationId, jobId, guardId } = body;
      if (!applicationId || !jobId || !guardId) throw new Error('applicationId, jobId, and guardId required');
      const { data: job } = await supabase.from('jobs').select('id, job_title').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const { data: guardData } = await supabase.from('guards').select('full_name').eq('id', guardId).maybeSingle();
      const guardName = guardData?.full_name || 'Guard';
      const { error } = await supabase.from('job_applications').update({ status: 'declined', updated_at: now }).eq('id', applicationId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: 'application_declined',
        action_description: `Declined application from ${guardName} for "${job.job_title}"`,
        target_type: 'job_application', target_name: job.job_title,
        metadata: { jobId, guardId, applicationId, adminId },
      });
      return new Response(JSON.stringify({ success: true, message: 'Application declined' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'bulk') {
      const { ids, bulkAction } = body;
      if (!ids || !ids.length || !bulkAction) throw new Error('ids and bulkAction required');
      let updatePayload: Record<string, any> = { updated_at: now };
      let actionType = '';
      let actionDesc = '';
      if (bulkAction === 'delete') { updatePayload = { is_deleted: true, deleted_at: now }; actionType = 'bulk_job_deleted'; actionDesc = `Bulk deleted ${ids.length} jobs`; }
      else if (bulkAction === 'close') { updatePayload.status = 'completed'; actionType = 'bulk_job_closed'; actionDesc = `Bulk closed ${ids.length} jobs`; }
      else if (bulkAction === 'pause') { updatePayload.status = 'paused'; actionType = 'bulk_job_paused'; actionDesc = `Bulk paused ${ids.length} jobs`; }
      else if (bulkAction === 'open') { updatePayload.status = 'open'; actionType = 'bulk_job_reopened'; actionDesc = `Bulk reopened ${ids.length} jobs`; }
      else if (bulkAction === 'flag') { updatePayload.risk_level = 'suspicious'; actionType = 'bulk_job_flagged'; actionDesc = `Bulk flagged ${ids.length} jobs`; }
      else { throw new Error('Invalid bulk action'); }
      const { error } = await supabase.from('jobs').update(updatePayload).in('id', ids);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: actionType, action_description: actionDesc,
        target_type: 'job', metadata: { action: bulkAction, jobIds: ids, adminId },
      });
      return new Response(JSON.stringify({ success: true, message: `${ids.length} jobs ${bulkAction}ed` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_payment_status') {
      const { jobId, newPaymentStatus, reason } = body;
      if (!jobId || !newPaymentStatus) throw new Error('jobId and newPaymentStatus required');
      const { data: job } = await supabase.from('jobs').select('id, job_title, payment_status').eq('id', jobId).maybeSingle();
      if (!job) throw new Error('Job not found');
      const oldStatus = job.payment_status || 'unpaid';
      const { error } = await supabase.from('jobs').update({ payment_status: newPaymentStatus, updated_at: now }).eq('id', jobId);
      if (error) throw error;
      await supabase.from('payment_audit_logs').insert({ job_id: jobId, from_status: oldStatus, to_status: newPaymentStatus, changed_by_role: 'admin', reason: reason || `Admin ${action} from ${oldStatus} to ${newPaymentStatus}` });
      await supabase.from('admin_activity_log').insert({
        admin_username: adminUser.email || 'admin', admin_name: adminName,
        action_type: 'payment_status_changed',
        action_description: `Changed payment status of "${job.job_title}" from ${oldStatus} to ${newPaymentStatus}`,
        target_type: 'job', target_name: job.job_title,
        metadata: { jobId, from: oldStatus, to: newPaymentStatus, reason: reason || '', adminId },
      });
      return new Response(JSON.stringify({ success: true, message: 'Payment status updated' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('admin-job-mutate error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
