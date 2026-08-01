'use client';

interface AlertItem {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: string;
  actionHref?: string;
}

interface Props {
  alerts: AlertItem[];
  loading: boolean;
}

function AlertIcon({ type }: { type: string }) {
  if (type === 'danger') {
    return (
      <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-error-warning-fill text-red-400"></i>
        </div>
      </div>
    );
  }
  if (type === 'warning') {
    return (
      <div className="w-9 h-9 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-alert-fill text-amber-400"></i>
        </div>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-sky-400/10 flex items-center justify-center flex-shrink-0">
      <div className="w-4 h-4 flex items-center justify-center">
        <i className="ri-information-fill text-sky-400"></i>
      </div>
    </div>
  );
}

function AlertBadge({ type }: { type: string }) {
  const classes =
    type === 'danger'
      ? 'bg-red-400/15 text-red-300 ring-1 ring-red-400/20'
      : type === 'warning'
      ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/20'
      : 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/20';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${classes}`}>
      {type}
    </span>
  );
}

export default function AlertsPanel({ alerts, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e2d4a]">
          <div className="w-24 h-4 bg-[#1a2b4a] rounded animate-pulse"></div>
        </div>
        <div className="divide-y divide-[#1e2d4a]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-[#1a2b4a]"></div>
              <div className="flex-1">
                <div className="w-32 h-4 bg-[#1a2b4a] rounded mb-2"></div>
                <div className="w-full h-3 bg-[#1a2b4a] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Platform Alerts</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {alerts.length === 0 ? 'All clear — no alerts right now' : `${alerts.length} alert${alerts.length > 1 ? 's' : ''} requiring attention`}
          </p>
        </div>
        {alerts.length > 0 && (
          <div className="w-8 h-8 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          </div>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="px-6 py-10 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-check-line text-emerald-400 text-xl"></i>
            </div>
          </div>
          <p className="text-sm text-slate-400 font-medium">All systems healthy</p>
          <p className="text-xs text-slate-500">No alerts detected for this period</p>
        </div>
      ) : (
        <div className="divide-y divide-[#1e2d4a]">
          {alerts.map((alert) => (
            <div key={alert.id} className="px-6 py-4 flex items-start gap-4">
              <AlertIcon type={alert.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white truncate">{alert.title}</span>
                  <AlertBadge type={alert.type} />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{alert.message}</p>
                {alert.action && (
                  <a
                    href={alert.actionHref || '#'}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-teal-400 hover:text-teal-300 cursor-pointer"
                  >
                    {alert.action}
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-arrow-right-line"></i>
                    </div>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}