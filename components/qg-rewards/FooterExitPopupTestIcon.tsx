'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isQGPopupAllowedPath } from '@/lib/qgLaunchPopupRoutes';

export default function FooterExitPopupTestIcon() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function checkSetting() {
      let enabled = false;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-public-launch-settings`);
        const data = await res.json();
        const val = data?.settings?.exit_popup_test_icon_enabled;
        enabled = val === true || val === 'true';
      } catch (_) {}

      if (cancelled) return;

      if (!enabled) {
        setVisible(false);
        return;
      }

      if (!isQGPopupAllowedPath(pathname || '')) {
        setVisible(false);
        return;
      }

      setVisible(true);
    }

    checkSetting();

    return () => { cancelled = true; };
  }, [pathname]);

  const handleClick = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('qg-open-exit-popup', { detail: { source: 'footer_test_icon' } }));
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
      aria-label="Test QG Launch Rewards popup"
      title="Test QG Launch Rewards popup"
    >
      <div className="w-4 h-4 flex items-center justify-center">
        <i className="ri-flask-line text-sm"></i>
      </div>
      <span className="text-xs font-medium whitespace-nowrap">Test Rewards Popup</span>
    </button>
  );
}