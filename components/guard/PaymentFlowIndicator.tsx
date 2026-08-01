'use client';

import { PaymentFlowStatus, formatFlowAmount } from '@/lib/payments/paymentFlowStatus';

interface Props {
  flow: PaymentFlowStatus;
  compact?: boolean;
}

const stageColors: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  complete: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400' },
  pending: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400' },
  failed: { dot: 'bg-red-500', bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400' },
  not_started: { dot: 'bg-slate-600', bg: 'bg-slate-500/5', border: 'border-slate-500/15', text: 'text-slate-500' },
};

function StageLight({ status, label, tooltip, detail }: { status: string; label: string; tooltip: string; detail?: string }) {
  const c = stageColors[status] || stageColors.not_started;
  return (
    <div className="flex flex-col items-center gap-1.5 group relative" title={tooltip}>
      <div className={`w-4 h-4 rounded-full ${c.dot} shadow-lg transition-all ${status === 'pending' ? 'animate-pulse' : ''}`} />
      <span className={`text-[10px] font-semibold whitespace-nowrap ${c.text}`}>{label}</span>
      {detail && <span className="text-[9px] text-slate-500 whitespace-nowrap">{detail}</span>}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
        <div className="bg-[#0B1933] border border-[#1a2b4a] text-slate-300 text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
          {tooltip}
        </div>
      </div>
    </div>
  );
}

export default function PaymentFlowIndicator({ flow, compact }: Props) {
  return (
    <div>
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4 sm:gap-6'}`}>
        <StageLight
          status={flow.job_secured.status}
          label={flow.job_secured.label}
          tooltip={flow.job_secured.tooltip}
          detail={compact ? undefined : (flow.job_secured.amount !== null ? formatFlowAmount(flow.job_secured.amount, flow.job_secured.currency) : undefined)}
        />
        <div className={`flex-1 h-0.5 rounded-full ${flow.job_secured.status === 'complete' ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
        <StageLight
          status={flow.client_released.status}
          label={flow.client_released.label}
          tooltip={flow.client_released.tooltip}
          detail={compact ? undefined : (flow.client_released.timestamp ? new Date(flow.client_released.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : undefined)}
        />
        <div className={`flex-1 h-0.5 rounded-full ${flow.client_released.status === 'complete' ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
        <StageLight
          status={flow.guard_paid.status}
          label={flow.guard_paid.label}
          tooltip={flow.guard_paid.tooltip}
          detail={compact ? undefined : (flow.guard_paid.amount !== null ? formatFlowAmount(flow.guard_paid.amount, flow.guard_paid.currency) : undefined)}
        />
      </div>

      {flow.requires_action && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-sm"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300">{flow.requires_action}</p>
            <div className="flex gap-2 mt-2">
              {flow.action_type === 'update_bank' && (
                <a href="/guard/bank-settings" className="px-3 py-1.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-[11px] font-semibold hover:bg-red-500/25 transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
                  <i className="ri-bank-line"></i>
                  Update Bank Details
                </a>
              )}
              <a href="/contact" className="px-3 py-1.5 border border-[#1a2b4a] text-slate-400 rounded-lg text-[11px] font-semibold hover:bg-[#162036] transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
                <i className="ri-customer-service-2-line"></i>
                Contact Support
              </a>
            </div>
          </div>
        </div>
      )}

      {!flow.requires_action && (
        <p className="text-[10px] text-slate-600 text-center mt-2.5">
          Payment moves through three stages: client pays QuickGuard, client confirms completion, then QuickGuard pays you.
        </p>
      )}
    </div>
  );
}