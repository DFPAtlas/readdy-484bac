'use client';

import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationPromptProps {
  role: 'guard' | 'client';
}

export default function PushNotificationPrompt({ role }: PushNotificationPromptProps) {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications(role);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(`quickguard_push_dismissed_${role}`);
    if (stored) {
      setDismissed(true);
      return;
    }
    if (supported && permission === 'default' && !subscribed) {
      const timer = setTimeout(() => setVisible(true), 3500);
      return () => clearTimeout(timer);
    }
  }, [supported, permission, subscribed, role]);

  if (!supported || dismissed || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem(`quickguard_push_dismissed_${role}`, 'true');
  };

  const handleSubscribe = async () => {
    await subscribe();
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  if (showSettings || (permission === 'denied' && !dismissed)) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[55] px-4 pt-3 pb-2">
        <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl shadow-2xl shadow-black/40 p-4 max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-notification-3-line text-blue-400 text-xl"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">Push Notifications</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {permission === 'denied'
                      ? 'Notifications are blocked. Enable them in your browser settings to get job alerts.'
                      : 'Get instant alerts for new jobs, messages, and status changes.'}
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                >
                  <i className="ri-close-line text-lg"></i>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {permission === 'denied' ? (
                  <button
                    onClick={handleDismiss}
                    className="flex-1 bg-[#162036] border border-[#1e2d4d] text-slate-300 text-xs font-semibold py-2.5 rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Got it
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleUnsubscribe}
                      disabled={loading}
                      className="flex-1 bg-[#162036] border border-[#1e2d4d] text-slate-300 text-xs font-semibold py-2.5 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      Turn Off
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="flex-1 bg-teal-500 text-slate-900 text-xs font-bold py-2.5 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      Keep On
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[55] px-4 pt-3 pb-2">
      <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 border border-teal-500/30 rounded-2xl shadow-2xl shadow-black/40 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-notification-3-line text-teal-400 text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">Enable Push Notifications</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {role === 'guard'
                    ? 'Get instant alerts when new jobs are posted, you get a message, or your shift status changes.'
                    : 'Get instant alerts when guards apply, your job status changes, or you receive messages.'}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400 mt-2">{error}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleDismiss}
                className="flex-1 bg-[#162036] border border-[#1e2d4d] text-slate-300 text-xs font-semibold py-2.5 rounded-xl cursor-pointer whitespace-nowrap"
              >
                Not Now
              </button>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="flex-1 bg-teal-500 text-slate-900 text-xs font-bold py-2.5 rounded-xl hover:bg-teal-400 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
              >
                {loading ? (
                  <i className="ri-loader-4-line animate-spin"></i>
                ) : (
                  <i className="ri-notification-3-line"></i>
                )}
                {loading ? 'Enabling...' : 'Enable Alerts'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}