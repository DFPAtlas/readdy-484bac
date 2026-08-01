'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { isQGPopupAllowedPath } from '@/lib/qgLaunchPopupRoutes';

export default function FooterExitPopupTestIcon() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function checkSetting() {
      const { data } = await supabase
        .from('qg_launch_reward_settings')
        .select('value')
        .eq('key', 'exit_popup_test_icon_enabled')
        .maybeSingle();

      if (cancelled) return;

      const enabled = data?.value === 'true' || data?.value === true;

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