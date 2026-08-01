'use client';

interface TimelineEvent {
  date: string;
  label: string;
  icon: string;
  color: string;
  source?: string;
}

interface JobTimelineProps {
  events: TimelineEvent[];
}

export default function JobTimeline({ events }: JobTimelineProps) {
  const formatDateTime = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventStyle = (color: string) => {
    const map: Record<string, { bg: string; ring: string; shadow: string }> = {
      'bg-blue-500': { bg: 'bg-blue-500', ring: 'ring-blue-500/30', shadow: 'shadow-blue-500/20' },
      'bg-sky-500': { bg: 'bg-sky-500', ring: 'ring-sky-500/30', shadow: 'shadow-sky-500/20' },
      'bg-violet-500': { bg: 'bg-violet-500', ring: 'ring-violet-500/30', shadow: 'shadow-violet-500/20' },
      'bg-emerald-500': { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', shadow: 'shadow-emerald-500/20' },
      'bg-amber-500': { bg: 'bg-amber-500', ring: 'ring-amber-500/30', shadow: 'shadow-amber-500/20' },
      'bg-teal-500': { bg: 'bg-teal-500', ring: 'ring-teal-500/30', shadow: 'shadow-teal-500/20' },
      'bg-red-500': { bg: 'bg-red-500', ring: 'ring-red-500/30', shadow: 'shadow-red-500/20' },
      'bg-rose-500': { bg: 'bg-rose-500', ring: 'ring-rose-500/30', shadow: 'shadow-rose-500/20' },
      'bg-orange-500': { bg: 'bg-orange-500', ring: 'ring-orange-500/30', shadow: 'shadow-orange-500/20' },
      'bg-yellow-500': { bg: 'bg-yellow-500', ring: 'ring-yellow-500/30', shadow: 'shadow-yellow-500/20' },
      'bg-emerald-600': { bg: 'bg-emerald-600', ring: 'ring-emerald-600/30', shadow: 'shadow-emerald-600/20' },
    };
    return map[color] || { bg: 'bg-slate-500', ring: 'ring-slate-500/30', shadow: 'shadow-slate-500/20' };
  };

  if (events.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-16 text-center">
        <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-time-line text-3xl text-slate-600"></i>
        </div>
        <h3 className="text-base font-semibold text-slate-300 mb-1">No timeline events yet</h3>
        <p className="text-sm text-slate-500">Activity will appear here as the job progresses.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-time-line text-teal-400 text-lg"></i>
          </div>
          Job Timeline
        </h2>
        <span className="text-xs text-slate-500">{events.length} events</span>
      </div>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[#1e2d4d]"></div>

        <div className="space-y-6">
          {events.map((event, index) => {
            const style = getEventStyle(event.color);
            return (
              <div key={index} className="flex items-start gap-4 relative group">
                <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0 z-10 shadow-sm ring-2 ${style.ring} ${style.shadow}`}>
                  <i className={`${event.icon} text-white text-base`}></i>
                </div>
                <div className="flex-1 bg-[#162036] rounded-xl p-4 border border-[#1e2d4d] min-w-0 group-hover:border-slate-600 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-200">{event.label}</p>
                    <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0" suppressHydrationWarning>
                      {formatDateTime(event.date)}
                    </span>
                  </div>
                  {event.source && (
                    <p className="text-xs text-slate-500 mt-1">{event.source}</p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-4 relative opacity-40">
            <div className="w-10 h-10 rounded-full bg-[#162036] flex items-center justify-center z-10 ring-2 ring-[#1e2d4d]">
              <i className="ri-more-line text-slate-500 text-base"></i>
            </div>
            <div className="flex-1 bg-[#162036] rounded-xl p-4 border border-dashed border-[#1e2d4d] min-w-0">
              <p className="text-sm font-medium text-slate-500">Future updates will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
