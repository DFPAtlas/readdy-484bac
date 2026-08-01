export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-red-500/10 text-red-400 border-red-500/20',
    under_review: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${map[status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${map[severity] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}