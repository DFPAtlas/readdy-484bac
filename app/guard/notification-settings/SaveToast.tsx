
'use client';

import { useEffect } from 'react';

interface SaveToastProps {
  show: boolean;
  success: boolean;
  message: string;
  onClose: () => void;
}

export default function SaveToast({ show, success, message, onClose }: SaveToastProps) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onClose, 3500);
      return () => clearTimeout(t);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border transition-all ${
      success
        ? 'bg-[#111d35] border-teal-500/30 text-white'
        : 'bg-[#111d35] border-red-500/30 text-white'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        success ? 'bg-teal-500/15' : 'bg-red-500/15'
      }`}>
        <i className={`text-base ${success ? 'ri-checkbox-circle-fill text-teal-400' : 'ri-error-warning-fill text-red-400'}`}></i>
      </div>
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-white cursor-pointer">
        <i className="ri-close-line text-base"></i>
      </button>
    </div>
  );
}
