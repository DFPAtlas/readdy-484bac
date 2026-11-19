import { getAttendanceStatus, getShiftPhase } from './attendance-display.cjs';
import { trackerHasLiveAttendance } from './client-job-tracker';

/** Dashboard alerts describe the current UK shift, while assignment history is retained. */
export function dashboardAttendance(jobs: any[], assignments: any[], now = new Date()) {
  const counts = { guardsNotCheckedIn: 0, lateGuards: 0, noShows: 0, jobsNeedingReplacement: 0 };
  const currentJobs = new Map(jobs.filter(job => job.is_deleted !== true && trackerHasLiveAttendance(job.status))
    .map(job => [job.id, job]));
  const replacements = new Set<string>();
  for (const assignment of assignments) {
    const job = currentJobs.get(assignment.job_id);
    if (!job || ['cancelled', 'completed'].includes(assignment.status) || assignment.completed_at ||
        assignment.check_out_time || ['checked_out', 'completed'].includes(assignment.attendance_status)) continue;
    const phase = getShiftPhase(job, now);
    if (phase !== 'upcoming' && phase !== 'active') continue;
    if (assignment.replacement_requested) replacements.add(job.id);
    if (phase !== 'active') continue;
    const attendance = getAttendanceStatus(assignment);
    if (attendance === 'late') counts.lateGuards++;
    if (attendance === 'no_show') counts.noShows++;
    if (!assignment.check_in_time && ['confirmed', 'not_checked_in', 'awaiting_confirmation'].includes(attendance)) counts.guardsNotCheckedIn++;
  }
  counts.jobsNeedingReplacement = replacements.size;
  return counts;
}
