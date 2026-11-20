import { withRequestDeadline } from './request-deadline';
import { sendJobMessage, verifyMessageOwner } from './job-messages';
export interface GuardActionTarget { id: string; user_id?: string | null; }
export async function runGuardActionBatch(db: any, owner: string, jobId: string, targets: GuardActionTarget[], action: 'invite' | 'message', operations: Map<string, string>, current = () => true) {
  const confirmedIds: string[] = [], failedIds: string[] = [];
  for (const target of targets) {
    await verifyMessageOwner(db, owner, current);
    try {
      if (action === 'invite') {
        const { data, error } = await withRequestDeadline<any>(db.rpc('create_client_job_invite', { p_job_id: jobId, p_guard_id: target.id, p_message: null }));
        if (error || typeof data?.invite_id !== 'string' || typeof data.replayed !== 'boolean') throw new Error('Invitation not confirmed');
      } else {
        if (!target.user_id) throw new Error('Guard account unavailable');
        const text = 'You have been shortlisted for our job. We will be in touch soon with next steps.';
        const key = JSON.stringify([owner, jobId, target.id, text]);
        if (!operations.has(key)) operations.set(key, crypto.randomUUID());
        await sendJobMessage(db, { id: operations.get(key)!, owner, other: target.user_id, job: jobId, text }, current);
      }
      await verifyMessageOwner(db, owner, current);
      confirmedIds.push(target.id);
    } catch {
      await verifyMessageOwner(db, owner, current);
      failedIds.push(target.id);
    }
  }
  return { confirmedIds, failedIds };
}
