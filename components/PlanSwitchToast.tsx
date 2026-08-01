'use client';

import { useEffect, useState } from 'react';

interface PlanSwitchToastProps {
  show: boolean;
  oldPlanName: string;
  newPlanName: string;
  onClose: () => void;
  autoDismissMs?: number;
}

export default function PlanSwitchToast({ show, oldPlanName, newPlanName, onClose, autoDismissMs = 6000 }: PlanSwitchToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setExiting(false);
      const timer = setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          setVisible(false);
          onClose();
        }, 300);
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [show, autoDismissMs, onClose]);

  if (!visible) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] transition-all duration-300 ${exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
      <div className="bg-[#0e1628] border border-emerald-500/30 rounded-2xl shadow-2xl p-5 max-w-md backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-emerald-500/15 rounded-xl border border-emerald-400/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-swap-line text-emerald-400 text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white mb-1">Plan Changed Successfully</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Switched from <span className="text-slate-300 font-semibold">{oldPlanName}</span> to{' '}
              <span className="text-emerald-400 font-semibold">{newPlanName}</span>. Prorated billing applied — no double charges.
            </p>
          </div>
          <button
            onClick={() => { setExiting(true); setTimeout(() => { setVisible(false); onClose(); }, 300); }}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
        </div>
      </div>
    </div>
  );
}