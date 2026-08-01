'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { clearAdminAuthCache } from '@/hooks/useAdminAuth';

const TIMEOUT_DURATION = 8 * 60 * 60 * 1000;
const WARNING_BEFORE = 5 * 60 * 1000;
const WARNING_AT = TIMEOUT_DURATION - WARNING_BEFORE;

const NO_SIDEBAR_PATHS = ['/admin/login', '/admin/setup', '/admin/register'];

export default function AdminSessionTimeout() {
  const router = useSafeRouter();
  const pathname = usePathname();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isProtected = !NO_SIDEBAR_PATHS.includes(pathname);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    clearAdminAuthCache();
    await supabase.auth.signOut();
    router.push('/admin/login');
  }, [router]);

  function clearAllTimers() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }

  const resetTimers = useCallback(() => {
    if (!isProtected) return;
    setShowWarning(false);
    clearAllTimers();

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(300);
      countdownRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_AT);

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, TIMEOUT_DURATION);
  }, [isProtected, handleLogout]);

  useEffect(() => {
    if (!isProtected) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handler = () => resetTimers();

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearAllTimers();
    };
  }, [isProtected, resetTimers]);

  useEffect(() => {
    resetTimers();
  }, [pathname]);

  if (!isProtected || !showWarning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-orange-100">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <i className="ri-time-line text-3xl text-orange-500"></i>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Expiring Soon</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            You've been inactive for a while. For your security, you'll be automatically logged out in:
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl px-8 py-4 mb-6">
            <span className="text-4xl font-bold text-orange-600 tabular-nums" suppressHydrationWarning={true}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleLogout}
              className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
            >
              <i className="ri-logout-box-line mr-2"></i>
              Log Out Now
            </button>
            <button
              onClick={resetTimers}
              className="flex-1 py-3 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-2"></i>
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}