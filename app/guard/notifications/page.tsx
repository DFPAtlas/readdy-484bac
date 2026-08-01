'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import NotificationHistory from '@/app/guard/dashboard/NotificationHistory';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import RoleSwitchModal from '@/components/RoleSwitchModal';

export default function GuardNotificationsPage() {
  const router = useRouter();
  const { loading: authLoading, allowed, roleSwitch } = useGuardGuard();
  const [guardUserId, setGuardUserId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/guard/login');
        return;
      }
      setGuardUserId(session.user.id);
      const { data: guard } = await supabase
        .from('guards')
        .select('full_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (guard) setGuardName(guard.full_name || '');
      setPageLoading(false);
    };
    init();
  }, [router]);

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin"></i>
          <p className="mt-4 text-slate-400">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (roleSwitch === 'client') {
    return <RoleSwitchModal targetRole="guard" />;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin"></i>
          <p className="mt-4 text-slate-400">Checking access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      <PortalSidebar
        role="guard"
        displayName={guardName || 'Guard'}
        subtitle="Verified"
        initials={guardName ? guardName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'GU'}
        accentColor="emerald"
      />
      <div className="flex-1 lg:ml-72 min-h-screen pt-16 lg:pt-8 pb-24 px-4 lg:pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/guard/dashboard#notifications"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#162036] border border-[#1e2d4d] text-slate-400 hover:text-white hover:bg-[#1a2642] transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line text-lg"></i>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Notification History</h1>
              <p className="text-sm text-slate-400">All your alerts, application updates, and messages</p>
            </div>
          </div>

          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl shadow-xl p-6">
            {guardUserId && <NotificationHistory guardUserId={guardUserId} />}
          </div>
        </div>
      </div>
    </div>
  );
}