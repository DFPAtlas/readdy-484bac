'use client';

import { useState, useEffect, useCallback } from 'react';

interface MobileInstallPromptProps {
  role?: 'guard' | 'client';
}

export default function MobileInstallPrompt({ role = 'guard' }: MobileInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if previously dismissed
    const dismissed = localStorage.getItem('quickguard_install_dismissed');
    if (dismissed) return;

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isMobile = isIOS || isAndroid || window.innerWidth < 768;

    if (!isMobile) return;

    if (isIOS) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('other');
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform('android');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Show after a short delay
    const timer = setTimeout(() => {
      setVisible(true);
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem('quickguard_install_dismissed', 'true');
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
        localStorage.setItem('quickguard_install_dismissed', 'true');
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (!visible || isStandalone) return null;

  const appName = role === 'guard' ? 'QuickGuard Guard' : 'QuickGuard Client';

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] px-4 pt-3 pb-2">
      <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl shadow-2xl shadow-black/40 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-shield-check-line text-white text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">Add {appName} to Home Screen</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {platform === 'ios' && 'Tap the share icon below, then scroll down and tap "Add to Home Screen".'}
                  {platform === 'android' && 'Install this app for quick access to your dashboard, jobs, and messages.'}
                  {platform === 'other' && 'Install this app for quick access to your dashboard.'}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                aria-label="Dismiss"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3">
              {platform === 'android' && deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-teal-500 text-slate-900 text-xs font-bold py-2.5 rounded-xl hover:bg-teal-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line mr-1"></i>
                  Install App
                </button>
              )}
              {platform === 'ios' && (
                <div className="flex-1 bg-[#162036] border border-[#1e2d4d] text-slate-300 text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap">
                  <i className="ri-share-box-line text-teal-400"></i>
                  Tap Share, then "Add to Home Screen"
                </div>
              )}
              {platform === 'other' && (
                <div className="flex-1 bg-[#162036] border border-[#1e2d4d] text-slate-300 text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap">
                  <i className="ri-smartphone-line text-teal-400"></i>
                  Add to Home Screen for quick access
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}