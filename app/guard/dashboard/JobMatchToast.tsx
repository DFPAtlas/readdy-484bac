
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  toastId: string;
}

interface JobMatchToastProps {
  guardUserId: string;
}

export default function JobMatchToast({ guardUserId }: JobMatchToastProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`job-match-toast-${guardUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'app',
          table: 'notifications',
          filter: `user_id=eq.${guardUserId}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string;
            title: string;
            message: string;
            type: string;
            link: string | null;
          };

          if (n.type !== 'job_match') return;

          const toastId = `${n.id}-${Date.now()}`;
          const toast: ToastNotification = {
            id: n.id,
            title: n.title,
            message: n.message,
            link: n.link,
            toastId,
          };

          setToasts(prev => [toast, ...prev].slice(0, 5));

          setTimeout(() => removeToast(toastId), 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guardUserId, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.toastId}
          className="pointer-events-auto w-80 bg-[#111d35] rounded-2xl shadow-2xl border border-[#1e2d4d] overflow-hidden animate-slide-in"
          style={{ animation: 'slideInRight 0.35s ease-out' }}
        >
          <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600 w-full" />
          <div className="p-4 flex gap-3 items-start">
            <div className="w-10 h-10 bg-teal-500/15 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-briefcase-line text-lg text-teal-400"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white leading-snug">{toast.title}</p>
                <button
                  onClick={() => removeToast(toast.toastId)}
                  className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 flex-shrink-0 cursor-pointer"
                >
                  <i className="ri-close-line text-base"></i>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{toast.message}</p>
              {toast.link && (
                <Link
                  href={toast.link}
                  className="inline-block mt-2 text-xs font-medium text-teal-400 hover:text-teal-300 whitespace-nowrap"
                >
                  View Job →
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
