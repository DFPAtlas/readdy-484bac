export type GuardApplicationGroup = 'pending' | 'reviewed' | 'selected' | 'accepted' | 'declined' | 'withdrawn' | 'unknown';

/** Selection by a client and acceptance of an offer remain distinct outcomes. */
export function guardApplicationGroup(status: string | null | undefined): GuardApplicationGroup {
  switch ((status || '').toLowerCase()) {
    case 'pending': case 'submitted': return 'pending';
    case 'reviewed': case 'shortlisted': return 'reviewed';
    case 'selected': return 'selected';
    case 'accepted': case 'confirmed': return 'accepted';
    case 'declined': case 'rejected': return 'declined';
    case 'withdrawn': return 'withdrawn';
    default: return 'unknown';
  }
}
