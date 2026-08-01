'use client';

import { TimelineEvent } from './SecuritySOCClient';

interface Props {
  timelineEvents: TimelineEvent[];
}

function getEventIcon(type: string) {
  switch (type) {
    case 'login': return { icon: 'ri-login-box-line', bg: 'bg-emerald-500/10', color: 'text-emerald-400' };
    case 'password': return { icon: 'ri-key-2-line', bg: 'bg-amber-500/10', color: 'text-amber-400' };
    case 'permission': return { icon: 'ri-shield-check-line', bg: 'bg-indigo-500/10', color: 'text-indigo-400' };
    case 'stripe': return { icon: 'ri-bank-card-line', bg: 'bg-violet-500/10', color: 'text-violet-400' };
    case 'storage': return { icon: 'ri-hard-drive-2-line', bg: 'bg-cyan-500/10', color: 'text-cyan-400' };
    case 'deploy': return { icon: 'ri-rocket-line', bg: 'bg-blue-500/10', color: 'text-blue-400' };
    case 'rls': return { icon: 'ri-database-2-line', bg: 'bg-purple-500/10', color: 'text-purple-400' };
    case 'failed_login': return { icon: 'ri-error-warning-line', bg: 'bg-red-500/10', color: 'text-red-400' };
    case 'emergency': return { icon: 'ri-alarm-warning-line', bg: 'bg-orange-500/10', color: 'text-orange-400' };
    default: return { icon: 'ri-circle-line', bg: 'bg-slate-500/10', color: 'text-slate-400' };
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SecurityTimeline({ timelineEvents }: Props) {
  const events = timelineEvents.slice(0, 15);

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-orange-500/10 rounded-lg">
            <i className="ri-timeline-view text-orange-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Security Timeline</h2>
        </div>
        <span className="text-xs text-slate-500">{events.length > 0 ? `Last ${events.length} events` : 'No events'}</span>
      </div>
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <i className="ri-timeline-view text-3xl mb-2"></i>
          <p className="text-sm">No security events recorded yet</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[#1a2b4a]"></div>
          <div className="space-y-0">
            {events.map((event) => {
              const { icon, bg, color } = getEventIcon(event.type);
              return (
                <div key={event.id} className="relative flex gap-4 pb-3 pl-10">
                  <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-[#111d35] ${bg} ring-2 ring-[#1a2b4a] z-10`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-5 h-5 flex items-center justify-center rounded ${bg} flex-shrink-0`}>
                        <i className={`${icon} text-[10px] ${color}`}></i>
                      </div>
                      <span className="text-xs font-medium text-slate-200">{event.description}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${event.type === 'failed_login' || event.type === 'emergency' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {event.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-500">{event.admin}</span>
                      {event.ip && <span className="text-[10px] text-slate-600 font-mono">{event.ip}</span>}
                      <span className="text-[10px] text-slate-600">{timeAgo(event.time)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}