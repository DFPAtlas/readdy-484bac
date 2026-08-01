import Link from 'next/link';

export interface AlertItem {
  id: number;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
  href: string;
}

interface Props {
  alerts: AlertItem[];
  loading?: boolean;
}

const alertStyles = {
  critical: {
    border: 'border-l-red-500',
    iconBg: 'bg-red-50 text-red-600',
    icon: 'ri-error-warning-line',
    btn: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: 'ri-alert-line',
    btn: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  info: {
    border: 'border-l-teal-500',
    iconBg: 'bg-teal-50 text-teal-600',
    icon: 'ri-check-line',
    btn: 'bg-teal-600 hover:bg-teal-700 text-white',
  },
};

function AlertSkeleton() {
  return (
    <div className="rounded-2xl border-l-[5px] border-l-[#1a2b4a] p-5 shadow-sm bg-[#111d35] flex items-start gap-4 animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-[#1a2b4a] flex-shrink-0"></div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="w-48 h-4 bg-[#1a2b4a] rounded"></div>
        <div className="w-64 h-3 bg-[#1a2b4a] rounded"></div>
      </div>
      <div className="w-24 h-9 bg-[#1a2b4a] rounded-xl flex-shrink-0"></div>
    </div>
  );
}

export default function DashboardAlerts({ alerts, loading }: Props) {
  if (loading) {
    return (
      <section aria-label="Alerts">
        <div className="space-y-3">
          <AlertSkeleton />
          <AlertSkeleton />
        </div>
      </section>
    );
  }

  if (alerts.length === 0) {
    return (
      <section aria-label="Alerts">
        <div className="rounded-2xl border-l-[5px] border-l-[#1a2b4a] p-5 shadow-sm bg-[#111d35] flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#1a2b4a] text-slate-500 flex-shrink-0">
            <i className="ri-check-line text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-400">No alerts</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">Everything is running smoothly. No issues to report.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Alerts">
      <div className="space-y-3">
        {alerts.map((alert) => {
          const style = alertStyles[alert.type] || alertStyles.info;
          return (
            <div
              key={alert.id}
              className={`rounded-2xl border-l-[5px] p-5 shadow-sm bg-[#111d35] flex items-start gap-4 transition-all hover:shadow-md ${style.border}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconBg}`}>
                <i className={`text-lg ${style.icon}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{alert.message}</p>
              </div>
              <Link
                href={alert.href}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 shadow-sm ${style.btn}`}
              >
                {alert.action}
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-right-line text-sm"></i>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}