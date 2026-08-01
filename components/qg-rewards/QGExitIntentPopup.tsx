'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isQGPopupAllowedPath } from '@/lib/qgLaunchPopupRoutes';

export default function QGExitIntentPopup() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [refCode, setRefCode] = useState('');
  const [closing, setClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const shownRef = useRef(false);
  const mobileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsLoadedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);

    const stored = localStorage.getItem('qg_referral_code') || sessionStorage.getItem('qg_referral_code') || '';
    setRefCode(stored);

    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
      setAuthChecked(true);
    });
  }, []);

  const supressAll = useCallback(() => {
    if (typeof window === 'undefined') return true;
    if (!authChecked) return true;
    if (isAuthenticated) return true;
    if (!isQGPopupAllowedPath(pathname || '')) return true;
    if (settings.exit_popup_enabled !== true && settings.exit_popup_enabled !== 'true') return true;
    if (sessionStorage.getItem('qg_exit_popup_seen') === 'true') return true;
    const joined = localStorage.getItem('qg_exit_popup_joined');
    if (joined === 'true') return true;
    const closedAt = localStorage.getItem('qg_exit_popup_closed_at');
    if (closedAt) {
      const cooldown = parseInt(settings.exit_popup_cooldown_days) || 7;
      const elapsed = Date.now() - parseInt(closedAt);
      if (elapsed < cooldown * 24 * 60 * 60 * 1000) return true;
      else localStorage.removeItem('qg_exit_popup_closed_at');
    }

    if (settings.exit_popup_show_on_all_public_pages === false || settings.exit_popup_show_on_all_public_pages === 'false') {
      const isHomepage = pathname === '/';
      const isRewardsPage = (pathname || '').startsWith('/qg-launch-rewards') && pathname !== '/qg-launch-rewards/temporary-profile';
      if (isHomepage && settings.exit_popup_show_on_homepage !== true && settings.exit_popup_show_on_homepage !== 'true') return true;
      if (isRewardsPage && settings.exit_popup_show_on_rewards_page !== true && settings.exit_popup_show_on_rewards_page !== 'true') return true;
      if (!isHomepage && !isRewardsPage) return true;
    }

    if (isMobile && settings.exit_popup_mobile_enabled !== true && settings.exit_popup_mobile_enabled !== 'true') return true;

    return false;
  }, [settings, isAuthenticated, authChecked, pathname, isMobile]);

  const triggerPopup = useCallback(() => {
    if (shownRef.current) return;
    if (supressAll()) return;
    shownRef.current = true;
    sessionStorage.setItem('qg_exit_popup_seen', 'true');
    setVisible(true);
  }, [supressAll]);

  const forceOpenPopup = useCallback(() => {
    if (typeof window === 'undefined') return;
    const globalDisabled = settings.exit_popup_enabled !== true && settings.exit_popup_enabled !== 'true';
    if (globalDisabled) return;
    setVisible(true);
  }, [settings]);

  useEffect(() => {
    if (!authChecked || typeof window === 'undefined') return;

    if (isAuthenticated) return;
    if (!isQGPopupAllowedPath(pathname || '')) return;

    const settingsOk = settings.exit_popup_enabled === true || settings.exit_popup_enabled === 'true';
    if (!settingsOk) return;

    if (isMobile) {
      const mobileEnabled = settings.exit_popup_mobile_enabled === true || settings.exit_popup_mobile_enabled === 'true';
      if (!mobileEnabled) return;
      const mobileDelay = (parseInt(settings.exit_popup_mobile_delay_seconds) || 45) * 1000;
      if (mobileDelay > 0) {
        mobileTimerRef.current = setTimeout(() => triggerPopup(), mobileDelay);
      }
      return () => {
        if (mobileTimerRef.current) clearTimeout(mobileTimerRef.current);
      };
    }

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && e.relatedTarget === null) {
        triggerPopup();
      }
    };

    document.addEventListener('mouseout', handleMouseLeave);
    return () => document.removeEventListener('mouseout', handleMouseLeave);
  }, [isMobile, settings, triggerPopup, authChecked, isAuthenticated, pathname]);

  useEffect(() => {
    const handleManualOpen = () => {
      forceOpenPopup();
    };
    window.addEventListener('qg-open-exit-popup', handleManualOpen);
    return () => window.removeEventListener('qg-open-exit-popup', handleManualOpen);
  }, [forceOpenPopup]);

  useEffect(() => {
    if (!visible) return;
    closeBtnRef.current?.focus();

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible]);

  useEffect(() => {
    if (settingsLoadedRef.current) return;
    async function loadSettings() {
      const { data } = await supabase.from('qg_launch_reward_settings').select('key,value');
      if (data) {
        const map: any = {};
        data.forEach((r: any) => { try { map[r.key] = JSON.parse(r.value); } catch { map[r.key] = r.value; } });
        setSettings(map);
      }
      settingsLoadedRef.current = true;
    }
    loadSettings();
  }, []);

  const closePopup = () => {
    setClosing(true);
    localStorage.setItem('qg_exit_popup_closed_at', String(Date.now()));
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 200);
  };

  const handleSignupClick = () => {
    localStorage.setItem('qg_exit_popup_joined', 'true');
    setVisible(false);
  };

  const signupUrl = (path: string) => `${path}${refCode ? `?ref=${refCode}` : ''}`;

  if (!authChecked) return null;
  if (isAuthenticated) return null;
  if (!isQGPopupAllowedPath(pathname || '')) return null;
  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="QG Launch Rewards exit popup"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg bg-[#0e1a2e] border border-[#1a2b4a] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          onClick={closePopup}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors z-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400"
          aria-label="Close popup"
        >
          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-line"></i></div>
        </button>

        <div className="p-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10">
              <i className="ri-rocket-2-line text-teal-400"></i>
            </div>
            <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Launch Rewards</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Leaving already?</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Join QuickGuard early access and start earning QG Tokens. Create a temporary guard or client launch profile, recommend trusted guards or businesses, and earn QG Tokens towards future QuickGuard discounts.
          </p>

          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-500/20 flex-shrink-0">
                <i className="ri-coins-line text-teal-400 text-lg"></i>
              </div>
              <div>
                <p className="text-white font-bold">100 QG Tokens = £10 QuickGuard Credit</p>
                <p className="text-slate-400 text-xs mt-0.5">QG Tokens are discount credits only. They activate after verified account creation and have no cash value.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href={signupUrl('/qg-launch-rewards/temporary-profile')}
              onClick={handleSignupClick}
              className="block w-full py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl text-sm text-center hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0e1a2e]"
            >
              Create Temporary Launch Profile
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={signupUrl('/guard/register')}
                onClick={handleSignupClick}
                className="block py-3 bg-slate-800 text-slate-300 rounded-xl text-sm text-center font-medium hover:bg-slate-700 transition-colors border border-[#1a2b4a] whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0e1a2e]"
              >
                <div className="w-4 h-4 flex items-center justify-center mx-auto mb-1"><i className="ri-shield-user-line text-teal-400 text-sm"></i></div>
                Join as a Guard
              </Link>
              <Link
                href={signupUrl('/client/register')}
                onClick={handleSignupClick}
                className="block py-3 bg-slate-800 text-slate-300 rounded-xl text-sm text-center font-medium hover:bg-slate-700 transition-colors border border-[#1a2b4a] whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0e1a2e]"
              >
                <div className="w-4 h-4 flex items-center justify-center mx-auto mb-1"><i className="ri-building-line text-teal-400 text-sm"></i></div>
                Join as a Client
              </Link>
            </div>
          </div>

          <button
            onClick={closePopup}
            className="w-full mt-4 py-2.5 text-slate-500 hover:text-slate-300 text-sm transition-colors cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-teal-400 rounded-lg"
          >
            No thanks, I'll continue browsing
          </button>
        </div>

        <div className="px-8 pb-4 text-center">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            QG Tokens are discount credits only. They have no cash value, cannot be withdrawn or transferred, and activate after verified account creation. Single-level referrals only.
          </p>
        </div>
      </div>
    </div>
  );
}