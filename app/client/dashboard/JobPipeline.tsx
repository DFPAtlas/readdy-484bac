'use client';

interface PipelineStage {
  label: string;
  count: number;
  icon: string;
  color: string;
}

interface JobPipelineProps {
  draftCount: number;
  postedCount: number;
  applicationsCount: number;
  selectedCount: number;
  paymentPendingCount: number;
  activeCount: number;
  completedCount: number;
  loading?: boolean;
}

export default function JobPipeline({
  draftCount,
  postedCount,
  applicationsCount,
  selectedCount,
  paymentPendingCount,
  activeCount,
  completedCount,
  loading = false,
}: JobPipelineProps) {
  const stages: PipelineStage[] = [
    { label: 'Draft', count: draftCount, icon: 'ri-file-edit-line', color: 'text-slate-500' },
    { label: 'Posted', count: postedCount, icon: 'ri-send-plane-line', color: 'text-blue-500' },
    { label: 'Applications', count: applicationsCount, icon: 'ri-user-add-line', color: 'text-violet-500' },
    { label: 'Selected', count: selectedCount, icon: 'ri-user-follow-line', color: 'text-indigo-500' },
    { label: 'Payment', count: paymentPendingCount, icon: 'ri-bank-card-line', color: 'text-amber-500' },
    { label: 'Active', count: activeCount, icon: 'ri-shield-check-line', color: 'text-emerald-500' },
    { label: 'Completed', count: completedCount, icon: 'ri-check-double-line', color: 'text-teal-500' },
  ];

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6 mb-6">
        <div className="h-5 bg-[#1a2b4a] rounded w-28 mb-4 animate-pulse" />
        <div className="flex items-center gap-2 overflow-x-auto">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-28 h-16 bg-[#1a2b4a] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6 mb-6">
      <h2 className="text-base font-semibold text-white mb-4">Job Pipeline</h2>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 bg-[#162036] rounded-xl border border-[#1a2b4a] flex items-center justify-center">
                <i className={`${stage.icon} text-xl ${stage.color}`} />
              </div>
              <p className="text-lg font-bold text-white">{stage.count}</p>
              <p className="text-[10px] text-slate-400 whitespace-nowrap">{stage.label}</p>
            </div>
            {index < stages.length - 1 && (
              <div className="w-4 h-px bg-[#1a2b4a] mb-5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}