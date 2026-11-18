export interface ReplacementSubmission {
  requestId: string;
  clientId: string;
  jobId: string;
  assignmentId: string;
  reason: string;
  urgency: string;
  arrival: string;
  notes: string;
  phone: string;
  createTicket: boolean;
}
export interface ReplacementReceipt {
  requestId: string;
  ticketId: string | null;
  supportSyncPending: boolean;
}
export async function submitReplacementRequest(db: any, submission: ReplacementSubmission, isCurrent: () => boolean): Promise<ReplacementReceipt> {
  const fail = (canEdit = false) => Object.assign(new Error('Unable to confirm the request. Retry with the same details to check it safely.'), {canEdit});
  if (!isCurrent()) throw fail();
  let auth;
  try { auth = await db.auth.getUser(); } catch { throw fail(true); }
  if (auth.error || !auth.data?.user?.id || !isCurrent()) throw fail(true);
  const result = await db.functions.invoke('submit-replacement-request', {body: submission});
  if (result.error) {
    let canEdit = false;
    const context = result.error.context;
    if ([400, 403].includes(context?.status)) {
      try { canEdit = (await context.clone().json()).outcome === 'rejected'; } catch { /* Keep uncertain writes locked. */ }
    }
    throw fail(canEdit);
  }
  const receipt = result.data?.receipt;
  const wantsTicket = submission.createTicket && ['urgent', 'emergency'].includes(submission.urgency);
  if (!isCurrent() || result.error || result.data?.success !== true || receipt?.requestId !== submission.requestId ||
      receipt.clientId !== submission.clientId || receipt.jobId !== submission.jobId ||
      !(receipt.ticketId === null || typeof receipt.ticketId === 'string' && receipt.ticketId.length > 0) ||
      !!receipt.ticketId !== wantsTicket || typeof result.data.supportSyncPending !== 'boolean') throw fail();
  return {requestId: receipt.requestId, ticketId: receipt.ticketId, supportSyncPending: result.data.supportSyncPending};
}
