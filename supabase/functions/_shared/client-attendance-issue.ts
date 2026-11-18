export class AttendanceIssueError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordClientAttendanceIssue(db: any, userId: string, body: any) {
  const {clientId, jobId, assignmentId, issue} = body || {};
  if (!userId) throw new AttendanceIssueError(401, 'Authentication required');
  if (![clientId, jobId, assignmentId].every(id => typeof id === 'string' && uuid.test(id))) throw new AttendanceIssueError(400, 'Invalid identifiers');
  if (issue !== null && (!issue || !['no_show', 'late', 'poor_performance', 'other'].includes(issue.type) || typeof issue.notes !== 'string' || issue.notes.length > 500)) throw new AttendanceIssueError(400, 'Invalid issue');

  const closure = await db.from('account_closures').select('user_id').eq('user_id', userId).maybeSingle();
  if (closure.error) throw new AttendanceIssueError(503, 'Unable to verify account status');
  if (closure.data) throw new AttendanceIssueError(403, 'Account closed');
  const client = await db.from('clients').select('id').eq('id', clientId).eq('user_id', userId).maybeSingle();
  if (client.error) throw new AttendanceIssueError(503, 'Unable to verify client');
  if (client.data?.id !== clientId) throw new AttendanceIssueError(403, 'Client account not found');
  const job = await db.from('jobs').select('id, client_id, is_deleted').eq('id', jobId).eq('client_id', clientId).maybeSingle();
  if (job.error) throw new AttendanceIssueError(503, 'Unable to verify job');
  if (job.data?.id !== jobId || job.data.client_id !== clientId || job.data.is_deleted !== false) throw new AttendanceIssueError(404, 'Job not found');
  const assignment = await db.from('job_assignments')
    .select('id, job_id, status, attendance_status, check_in_time, check_out_time, updated_at')
    .eq('id', assignmentId).eq('job_id', jobId).maybeSingle();
  if (assignment.error) throw new AttendanceIssueError(503, 'Unable to verify assignment');
  const row = assignment.data;
  if (row?.id !== assignmentId || row.job_id !== jobId) throw new AttendanceIssueError(404, 'Assignment not found');
  if (row.updated_at !== null && typeof row.updated_at !== 'string') throw new AttendanceIssueError(503, 'Unable to verify assignment version');

  // Client reports may mark missing/late arrival, but cannot rewrite recorded attendance evidence.
  const mayMarkArrival = !row.check_in_time && !row.check_out_time &&
    !['checked_in', 'checked_out', 'completed'].includes(row.attendance_status) &&
    !['completed', 'cancelled', 'refunded', 'rejected'].includes(row.status);
  const changes = issue
    ? {issue_reported: true, issue_type: issue.type, issue_notes: issue.notes.trim(),
      ...(mayMarkArrival && ['no_show', 'late'].includes(issue.type) ? {attendance_status: issue.type} : {})}
    : {issue_reported: false, issue_type: null, issue_notes: null};
  let update = db.from('job_assignments').update({...changes, updated_at: new Date().toISOString()})
    .eq('id', assignmentId).eq('job_id', jobId);
  // Reject a concurrent check-in or another editor's change instead of overwriting it.
  update = row.updated_at === null ? update.is('updated_at', null) : update.eq('updated_at', row.updated_at);
  const saved = await update.select('id, job_id, issue_reported, issue_type, issue_notes, attendance_status').maybeSingle();
  if (saved.error) throw new AttendanceIssueError(503, 'Attendance change could not be confirmed');
  if (saved.data?.id !== assignmentId || saved.data.job_id !== jobId ||
      Object.entries(changes).some(([key, value]) => saved.data[key] !== value)) throw new AttendanceIssueError(409, 'Assignment changed. Reload the job before retrying.');
  return saved.data;
}
