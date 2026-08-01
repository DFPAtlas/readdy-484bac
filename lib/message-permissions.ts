import { supabase } from './supabase';

interface CanSendJobMessageArgs {
  currentUserId: string;
  currentUserType: 'client' | 'guard';
  jobId: string;
  otherUserId: string;
  otherUserType?: 'client' | 'guard' | 'admin' | 'support';
}

export async function canSendJobMessage({
  currentUserId,
  currentUserType,
  jobId,
  otherUserId,
  otherUserType,
}: CanSendJobMessageArgs): Promise<{ allowed: boolean; error?: string }> {
  try {
    const [jobRes, guardRes] = await Promise.all([
      supabase.from('jobs').select('id, client_id').eq('id', jobId).maybeSingle(),
      supabase.from('guards').select('id, user_id').eq('user_id', currentUserType === 'guard' ? currentUserId : otherUserId).maybeSingle(),
    ]);

    const job = jobRes.data;
    const guard = guardRes.data;

    if (!job) {
      return { allowed: false, error: 'Job not found.' };
    }

    if (!guard) {
      return { allowed: false, error: 'Guard not found.' };
    }

    let jobBelongsToCorrectClient = false;
    if (currentUserType === 'client') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', currentUserId)
        .maybeSingle();
      jobBelongsToCorrectClient = !!client && job.client_id === client.id;
    } else {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', otherUserId)
        .maybeSingle();
      jobBelongsToCorrectClient = !!client && job.client_id === client.id;
    }

    if (!jobBelongsToCorrectClient) {
      return { allowed: false, error: 'You can only message about jobs you own or are assigned to.' };
    }

    const [appRes, assignRes, inviteRes] = await Promise.all([
      supabase
        .from('job_applications')
        .select('id')
        .eq('job_id', jobId)
        .eq('guard_id', guard.id)
        .maybeSingle(),
      supabase
        .from('job_assignments')
        .select('id')
        .eq('job_id', jobId)
        .eq('guard_id', guard.id)
        .maybeSingle(),
      supabase
        .from('job_invites')
        .select('id')
        .eq('job_id', jobId)
        .eq('guard_id', guard.id)
        .maybeSingle(),
    ]);

    const hasRelationship = !!(appRes.data || assignRes.data || inviteRes.data);

    if (!hasRelationship) {
      return { allowed: false, error: 'You can only message guards or clients linked to this job.' };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, error: 'Unable to verify messaging permissions. Please try again.' };
  }
}