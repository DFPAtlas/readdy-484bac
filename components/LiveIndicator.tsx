interface LiveIndicatorProps {
  label?: string;
  status?: 'connected' | 'reconnecting' | 'disconnected' | 'error';
}

const STATUS_MAP = {
  connected: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  reconnecting: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500', text: 'text-amber-500' },
  disconnected: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', dot: 'bg-slate-500', text: 'text-slate-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500', text: 'text-red-500' },
};

export default function LiveIndicator({ label, status = 'connected' }: LiveIndicatorProps) {
  const s = STATUS_MAP[status];
  const displayLabel = label || (status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting' : status === 'error' ? 'Error' : 'Offline');

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${s.bg} border ${s.border}`}>
      <span className="relative flex h-2 w-2">
        {status === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        {status === 'reconnecting' && (
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${s.dot}`}></span>
      </span>
      <span className={`text-[11px] font-bold uppercase tracking-widest ${s.text}`}>{displayLabel}</span>
    </div>
  );
}