export interface ActivityItem {
  id: string;
  icon: string;
  color: string;
  title: string;
  message: string;
  time: string;
  timestamp: string;
}

interface Props {
  activities: ActivityItem[];
  loading: boolean;
  error?: string | null;
}

function ActivitySkeleton() {
  return (
    <div className="px-6 py-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#1a2b4a] animate-pulse flex-shrink-0 mt-0.5"></div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="w-32 h-4 bg-[#1a2b4a] rounded animate-pulse"></div>
        <div className="w-48 h-3 bg-[#1a2b4a] rounded animate-pulse"></div>
      </div>
      <div className="w-14 h-3 bg-[#1a2b4a] rounded animate-pulse flex-shrink-0 mt-1"></div>
    </div>
  );
}

export default function DashboardActivity({ activities, loading, error }: Props) {
  return (
    <section className="lg:col-span-2" aria-labelledby="activity-heading">
      <div className="bg-[#111d35] rounded-2xl shadow-sm border border-[#1a2b4a] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#1a2b4a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a2b4a] text-slate-400">
              <i className="ri-history-line text-lg"></i>
            </div>
            <h2 id="activity-heading" className="text-base font-bold text-white">
              Recent Activity
            </h2>
          </div>
          <a
            href="/admin/activity-log"
            className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            View all
          </a>
        </div>

        {error && (
          <div className="px-6 py-6 text-center border-b border-[#1a2b4a]/50">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 mx-auto mb-3">
              <i className="ri-error-warning-line text-lg"></i>
            </div>
            <p className="text-sm font-medium text-red-400">{error}</p>
            <p className="text-xs text-slate-500 mt-1">Activity data could not be loaded</p>
          </div>
        )}

        <div className="divide-y divide-[#1a2b4a]/50">
          {loading && !error ? (
            Array.from({ length: 6 }).map((_, i) => (
              <ActivitySkeleton key={`activity-skeleton-${i}`} />
            ))
          ) : activities.length === 0 && !error ? (
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#1a2b4a] text-slate-500 mx-auto mb-4">
                <i className="ri-inbox-line text-3xl"></i>
              </div>
              <p className="text-sm font-semibold text-slate-400 mb-1">No recent activity</p>
              <p className="text-sm text-slate-500">Nothing happened in the last 7 days</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="px-6 py-4 flex items-start gap-4 hover:bg-[#1a2b4a]/40 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${activity.color}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${activity.icon} text-base`}></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{activity.title}</p>
                  <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                    {activity.message}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0 mt-1 whitespace-nowrap">
                  {activity.time}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}