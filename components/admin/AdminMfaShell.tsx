'use client';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { clearAdminAuthCache } from '@/hooks/useAdminAuth';

interface AdminMfaShellProps {
  title: string;
  subtitle: string;
  icon?: string;
  children: React.ReactNode;
}

export default function AdminMfaShell({
  title,
  subtitle,
  icon = 'ri-shield-keyhole-line',
  children,
}: AdminMfaShellProps) {
  const router = useSafeRouter();

  const handleSignOut = async () => {
    clearAdminAuthCache();
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-[#071321] relative">
      <div className="absolute top-6 left-6 z-20">
        <Link href="/" className="inline-flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1DA1F2]/15 border border-[#1DA1F2]/20">
            <i className="ri-shield-check-fill text-[#1DA1F2] text-base" />
          </div>
          <span className="font-[family-name:var(--font-pacifico)] text-lg text-white">QuickGuard</span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 relative">
        <div className="relative z-10 w-full max-w-[460px]">
          <div
            className="rounded-[20px] border p-8 md:p-10"
            style={{
              background: 'rgba(14,27,46,0.85)',
              borderColor: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex flex-col items-center mb-6">
              <div
                className="w-14 h-14 flex items-center justify-center rounded-full mb-5"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <i className={`text-2xl text-amber-400 ${icon}`} />
              </div>
              <h2 className="text-2xl font-bold text-white text-center">{title}</h2>
              <p className="text-sm text-[#AAB7C4] text-center mt-1.5">{subtitle}</p>
            </div>

            {children}

            <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.08)] text-center">
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-[#AAB7C4] hover:text-red-400 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="ri-logout-box-r-line" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}