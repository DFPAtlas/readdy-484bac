'use client';

interface AlertItem {
  clientId: string;
  clientName: string;
  alert: string;
  label: string;
  color: string;
  icon: string;
}

interface AlertsProps {
  alerts: AlertItem[];
}

export default function ClientMonitoringAlerts({ alerts }: AlertsProps) {
  if (alerts.length === 0) return null;

  const colorMap: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-sky-50 border-sky-200 text-sky-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };

  const iconMap: Record<string, string> = {
    red: 'text-red-500',
    amber: 'text-amber-500',
    blue: 'text-sky-500',
    orange: 'text-orange-500',
    slate: 'text-slate-500',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50">
          <i className="ri-alarm-warning-line text-red-500"></i>
        </div>
        <h2 className="text-base font-bold text-slate-900">
          Urgent Alerts ({alerts.length})
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {alerts.slice(0, 8).map((alert, idx) => (
          <div
            key={`${alert.clientId}-${alert.alert}-${idx}`}
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              colorMap[alert.color] || colorMap.red
            }`}
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/60 flex-shrink-0">
              <i className={`${alert.icon} ${iconMap[alert.color] || iconMap.red}`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{alert.label}</p>
              <p className="text-xs opacity-80 truncate">
                {alert.clientName}
              </p>
            </div>
          </div>
        ))}
      </div>
      {alerts.length > 8 && (
        <p className="text-xs text-slate-500 pl-1">
          +{alerts.length - 8} more alerts — filter by "Has Alerts" to see all
        </p>
      )}
    </div>
  );
}