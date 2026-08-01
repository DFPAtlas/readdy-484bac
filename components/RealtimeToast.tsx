'use client';

import { useState, useEffect, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

let globalToastListeners: Array<(toast: Toast) => void> = [];

export function showRealtimeToast(message: string, type: 'success' | 'info' | 'warning' = 'info') {
  const toast: Toast = {
    id: Math.random().toString(36).slice(2),
    message,
    type,
  };
  globalToastListeners.forEach((cb) => cb(toast));
}

export default function RealtimeToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (toast: Toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    globalToastListeners.push(handler);
    return () => {
      globalToastListeners = globalToastListeners.filter((cb) => cb !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-24 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border animate-fade-in backdrop-blur-sm ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : toast.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success'
              ? 'bg-emerald-500/20'
              : toast.type === 'warning'
              ? 'bg-amber-500/20'
              : 'bg-teal-500/20'
          }`}>
            <i className={`${
              toast.type === 'success'
                ? 'ri-checkbox-circle-fill text-emerald-400'
                : toast.type === 'warning'
                ? 'ri-alarm-warning-fill text-amber-400'
                : 'ri-notification-3-fill text-teal-400'
            } text-lg`}></i>
          </div>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}