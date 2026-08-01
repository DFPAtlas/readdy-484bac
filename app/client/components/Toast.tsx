'use client';

import { useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose?: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const iconMap = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    info: 'ri-information-fill',
  };
  const colorMap = {
    success: 'text-teal-400',
    error: 'text-red-400',
    info: 'text-blue-400',
  };

  return (
    <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d]">
      <i className={`${iconMap[type]} ${colorMap[type]}`}></i>
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          <i className="ri-close-line text-sm"></i>
        </button>
      )}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const hideToast = () => setToast(null);

  return { toast, showToast, hideToast };
}