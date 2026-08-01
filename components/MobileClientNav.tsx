'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MOBILE_BREAKPOINT = 768;

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', href: '/client/dashboard' },
  { id: 'jobs', label: 'Jobs', icon: 'ri-briefcase-4-line', activeIcon: 'ri-briefcase-fill', href: '/client/jobs' },
  { id: 'post', label: 'Post', icon: 'ri-add-circle-line', activeIcon: 'ri-add-circle-fill', href: '/client/post-job' },
  { id: 'messages', label: 'Messages', icon: 'ri-message-3-line', activeIcon: 'ri-message-3-fill', href: '/client/messages' },
  { id: 'account', label: 'Account', icon: 'ri-user-line', activeIcon: 'ri-user-fill', href: '/client/profile' },
];

export default function MobileClientNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('is_read', false);
      setUnreadCount(notifCount || 0);

      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', uid)
        .eq('read', false);
      setMessageCount(msgCount || 0);
    };
    loadCounts();
  }, [pathname]);

  if (!isMobile) return null;

  if (pathname.startsWith('/client/mobile')) return null;

  const getActiveId = () => {
    if (pathname === '/client/dashboard' || pathname === '/client/mobile') return 'dashboard';
    if (pathname.startsWith('/client/jobs')) return 'jobs';
    if (pathname.startsWith('/client/post-job') || pathname.startsWith('/client/mobile/post-job')) return 'post';
    if (pathname.startsWith('/client/messages')) return 'messages';
    if (pathname.startsWith('/client/profile') || pathname.startsWith('/client/notifications') || pathname.startsWith('/client/support') || pathname.startsWith('/client/payment-history') || pathname.startsWith('/client/reports') || pathname.startsWith('/client/trust-safety')) return 'account';
    return 'dashboard';
  };

  const activeId = getActiveId();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111d35] border-t border-[#1e2d4d] z-50 lg:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto px-1 pb-5 pt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id;
          const hasBadge = item.id === 'messages' && messageCount > 0;
          const hasNotifBadge = item.id === 'account' && unreadCount > 0;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className="relative flex flex-col items-center gap-1 px-2 py-1 cursor-pointer min-w-[56px]"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${isActive ? item.activeIcon : item.icon} text-lg ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-teal-400' : 'text-slate-500'}`}>
                {item.label}
              </span>
              {hasBadge && (
                <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {messageCount > 9 ? '9+' : messageCount}
                </span>
              )}
              {hasNotifBadge && (
                <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}