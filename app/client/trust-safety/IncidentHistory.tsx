import Link from 'next/link';

interface Incident {
  id: string;
  ticket_reference: string | null;
  job_id: string | null;
  category: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  description: string;
}

interface JobMap {
  [id: string]: { job_title: string; venue_name: string };
}

interface IncidentHistoryProps {
  incidents: Incident[];
  jobs: JobMap;
}

const priorityBadge = (p: string) => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    urgent: { bg: 'bg-red-500/15', color: 'text-red-400', border: 'border-red-500/25' },
    high: { bg: 'bg-orange-500/15', color: 'text-orange-400', border: 'border-orange-500/25' },
    medium: { bg: 'bg-amber-500/15', color: 'text-amber-400', border: 'border-amber-500/25' },
    low: { bg: 'bg-slate-500/15', color: 'text-slate-400', border: 'border-slate-500/25' },
  };
  return map[p] || map.low;
};

const statusBadge = (s: string) => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    open: { bg: 'bg-blue-500/15', color: 'text-blue-400', border: 'border-blue-500/25' },
    awaiting_client: { bg: 'bg-amber-500/15', color: 'text-amber-400', border: 'border-amber-500/25' },
    under_review: { bg: 'bg-violet-500/15', color: 'text-violet-400', border: 'border-violet-500/25' },
    escalated: { bg: 'bg-orange-500/15', color: 'text-orange-400', border: 'border-orange-500/25' },
    resolved: { bg: 'bg-emerald-500/15', color: 'text-emerald-400', border: 'border-emerald-500/25' },
    closed: { bg: 'bg-slate-500/15', color: 'text-slate-400', border: 'border-slate-500/25' },
  };
  return map[s] || map.open;
};

const categoryLabel = (c: string) => {
  const map: Record<string, string> = {
    guard_no_show: 'Guard No-Show',
    late_arrival: 'Late Arrival',
    poor_performance: 'Poor Performance',
    safety_issue: 'Safety Issue',
    refund_request: 'Refund Request',
    general_support: 'General Support',
    dispute: 'Dispute',
  };
  return map[c] || c.replace(/_/g, ' ');
};

const categoryIcon = (c: string) => {
  const map: Record<string, string> = {
    guard_no_show: 'ri-user-unfollow-line',
    late_arrival: 'ri-time-line',
    poor_performance: 'ri-emotion-unhappy-line',
    safety_issue: 'ri-alert-line',
    refund_request: 'ri-refund-line',
    general_support: 'ri-customer-service-2-line',
    dispute: 'ri-scales-3-line',
  };
  return map[c] || 'ri-file-list-line';
};

export default function IncidentHistory({ incidents, jobs }: IncidentHistoryProps) {
  if (incidents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i className="ri-check-double-line text-2xl text-emerald-400 dark:text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No incidents recorded</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This is a good sign — all your jobs have been incident-free.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => {
        const p = priorityBadge(incident.priority);
        const s = statusBadge(incident.status);
        const job = incident.job_id ? jobs[incident.job_id] : null;
        const isResolved = incident.status === 'resolved' || incident.status === 'closed';

        return (
          <div
            key={incident.id}
            className={`bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 transition-all ${
              isResolved ? 'opacity-70' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${p.bg} border ${p.border}`}>
                <i className={`${categoryIcon(incident.category)} ${p.color} text-base`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{incident.subject}</h4>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.bg} ${p.color} ${p.border}`}>
                    {incident.priority}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.color} ${s.border}`}>
                    {incident.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap mb-2">
                  <span className="flex items-center gap-1">
                    <i className="ri-hashtag text-xs" />
                    {incident.ticket_reference || incident.id.slice(0, 8)}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line text-xs" />
                    {new Date(incident.created_at).toLocaleDateString('en-GB')}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-folder-line text-xs" />
                    {categoryLabel(incident.category)}
                  </span>
                  {job && (
                    <span className="flex items-center gap-1">
                      <i className="ri-briefcase-4-line text-xs" />
                      {job.job_title}
                    </span>
                  )}
                  {incident.resolved_at && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <i className="ri-check-double-line text-xs" />
                      Resolved {new Date(incident.resolved_at).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{incident.description}</p>
              </div>
            </div>
          </div>
        );
      })}

      <div className="text-center pt-2">
        <Link
          href="/client/support"
          className="inline-flex items-center gap-2 text-sm text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
        >
          <i className="ri-customer-service-2-line" />
          View All Support Tickets
        </Link>
      </div>
    </div>
  );
}