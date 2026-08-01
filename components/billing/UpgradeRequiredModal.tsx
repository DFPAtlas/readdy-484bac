'use client';

import { useState } from 'react';
import Link from 'next/link';

interface UpgradeRequiredModalProps {
  featureName: string;
  isOpen: boolean;
  onClose: () => void;
  audience?: 'client' | 'guard';
}

export default function UpgradeRequiredModal({ featureName, isOpen, onClose, audience }: UpgradeRequiredModalProps) {
  const [closing, setClosing] = useState(false);

  if (!isOpen && !closing) return null;

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  const planRoute = audience === 'guard' ? '/guard/profile' : '/client/profile';
  const upgradeRoute = '/pricing';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div
        className={`relative bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-2xl max-w-md w-full p-6 transition-all duration-200 ${
          closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-vip-crown-line text-2xl text-amber-400"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upgrade Required</h3>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Your current subscription does not include this feature. Upgrade your QuickGuard plan to unlock {featureName}.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <Link
            href={upgradeRoute}
            prefetch={false}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-colors whitespace-nowrap text-center cursor-pointer"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    </div>
  );
}