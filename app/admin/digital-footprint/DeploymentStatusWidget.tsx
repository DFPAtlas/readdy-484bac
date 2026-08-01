'use client';

interface DeploymentInfo {
  id: string | null;
  github_url: string | null;
  branch_name: string | null;
  commit_hash: string | null;
  commit_message: string | null;
  deployment_status: string | null;
  build_status: string | null;
  build_error_summary: string | null;
  deployed_at: string | null;
}

interface DeploymentStatusWidgetProps {
  deployment: DeploymentInfo | null;
  onClick: () => void;
}

export default function DeploymentStatusWidget({ deployment, onClick }: DeploymentStatusWidgetProps) {
  if (!deployment) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-600 bg-[#0a1628] border border-[#1a2b4a] hover:border-slate-500/30 hover:text-slate-400 transition-all cursor-pointer whitespace-nowrap"
      >
        <div className="w-3 h-3 flex items-center justify-center"><i className="ri-cloud-off-line text-[9px]"></i></div>
        Awaiting data
      </button>
    );
  }

  const buildFailed = deployment.build_status === 'failed';
  const buildPending = deployment.build_status === 'pending' || deployment.deployment_status === 'pending';
  const buildSuccess = deployment.build_status === 'success' && deployment.deployment_status === 'deployed';

  const badgeCls = buildFailed
    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:text-red-300'
    : buildPending
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300'
      : buildSuccess
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300'
        : 'bg-[#0a1628] text-slate-500 border-[#1a2b4a] hover:border-slate-500/30';

  const icon = buildFailed
    ? 'ri-close-circle-line'
    : buildPending
      ? 'ri-loader-4-line animate-spin'
      : buildSuccess
        ? 'ri-check-double-line'
        : 'ri-cloud-line';

  const statusLabel = buildFailed
    ? 'Build failed'
    : buildPending
      ? 'Pending'
      : buildSuccess
        ? 'Deployed'
        : deployment.build_status || 'Unknown';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap border ${badgeCls}`}
    >
      <div className="w-3 h-3 flex items-center justify-center"><i className={icon + ' text-[9px]'}></i></div>
      {statusLabel}
      {deployment.branch_name && (
        <span className="text-[9px] opacity-60 ml-0.5">
          ({deployment.commit_hash ? deployment.commit_hash.slice(0, 7) : deployment.branch_name})
        </span>
      )}
    </button>
  );
}