export type AttendanceIssueType = 'no_show' | 'late' | 'poor_performance' | 'other';

export interface SavedAttendanceIssue {
  id: string;
  job_id: string;
  issue_reported: boolean;
  issue_type: string | null;
  issue_notes: string | null;
  attendance_status: string | null;
}

export async function saveClientAttendanceIssue(
  db: any,
  context: { clientId: string; jobId: string; assignmentId: string },
  issue: { type: AttendanceIssueType; notes: string } | null,
  isCurrent: () => boolean = () => true,
): Promise<SavedAttendanceIssue> {
  const {clientId, jobId, assignmentId} = context;
  const fail = () => new Error('The attendance change could not be confirmed. Reload the job before retrying.');
  if (!clientId || !jobId || !assignmentId || !isCurrent()) throw fail();
  const auth = await db.auth.getUser();
  if (auth.error || !auth.data?.user?.id || !isCurrent()) throw fail();
  const result = await db.functions.invoke('client-attendance-issue', {body: {...context, issue}});
  const saved = result.data?.assignment;
  if (!isCurrent() || result.error || result.data?.success !== true || saved?.id !== assignmentId || saved?.job_id !== jobId ||
      saved.issue_reported !== !!issue || saved.issue_type !== (issue?.type || null) ||
      saved.issue_notes !== (issue ? issue.notes.trim() : null)) throw fail();
  return saved as SavedAttendanceIssue;
}
