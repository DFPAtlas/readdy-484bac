"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { rememberApplicationLink } from '@/lib/admin-application-link';
import AdminSidebar from '@/components/AdminSidebar';
import AdminSessionTimeout from '@/components/AdminSessionTimeout';
import AdminSessionHeartbeat from '@/components/AdminSessionHeartbeat';
import { supabase } from '@/lib/supabase';
import { clearAdminAuthCache } from '@/hooks/useAdminAuth';
import { resolveAdminMfaRoute } from '@/lib/admin-mfa';

const NO_SIDEBAR_PATHS = ['/admin/login', '/admin/setup', '/admin/register', '/admin/mfa', '/admin/mfa/setup'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useSafeRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stalled, setStalled] = useState(false);
  const [adminUser, setAdminUser] = useState<{ id: string; email: string } | null>(null);

  const activePath = (pathname || '').replace(/\/+$/, '') || '/';
  const isPublicAdminPath = NO_SIDEBAR_PATHS.includes(activePath);
  const showSidebar = !isPublicAdminPath;

  useEffect(() => {
    if (!loading) {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    if (NO_SIDEBAR_PATHS.includes(activePath)) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    rememberApplicationLink();
    setLoading(true);
    setIsAuthorized(false);

    async function verifyAdmin() {
      try {
        // A cached JWT can outlive its server session after sign-out or revocation.
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError || !user) {
          clearAdminAuthCache();
          await supabase.auth.signOut({ scope: 'local' });
          if (cancelled) return;
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        if (cancelled) return;

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id, role, is_active, full_name, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (adminCheck && adminCheck.is_active && ['super_admin', 'admin', 'finance_admin'].includes(adminCheck.role)) {
          const mfaRoute = await resolveAdminMfaRoute();
          if (mfaRoute === 'mfa') {
            setLoading(false);
            router.push('/admin/mfa');
            return;
          }
          if (mfaRoute === 'setup') {
            setLoading(false);
            router.push('/admin/mfa/setup');
            return;
          }
          if (mfaRoute !== 'authorized') {
            await supabase.auth.signOut();
            clearAdminAuthCache();
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            setLoading(false);
            router.push('/admin/login');
            return;
          }
          setIsAuthorized(true);
          setAdminUser({ id: adminCheck.id, email: adminCheck.email });
          setLoading(false);
          return;
        }

        if (adminCheck && !adminCheck.is_active) {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        if (adminCheck && !['super_admin', 'admin', 'finance_admin'].includes(adminCheck.role)) {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        const { data, error } = await supabase.functions.invoke('admin-security', {
          body: { action: 'verify' },
        });

        if (cancelled) return;

        if (error || !data?.verified) {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        const validRoles = ['super_admin', 'admin', 'finance_admin'];
        if (!validRoles.includes(data.role)) {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        const mfaRoute = await resolveAdminMfaRoute();
        if (mfaRoute === 'mfa') {
          setLoading(false);
          router.push('/admin/mfa');
          return;
        }
        if (mfaRoute === 'setup') {
          setLoading(false);
          router.push('/admin/mfa/setup');
          return;
        }
        if (mfaRoute !== 'authorized') {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        setIsAuthorized(true);
        setLoading(false);

        const { data: adminLookup } = await supabase
          .from('admin_users')
          .select('id, email')
          .eq('user_id', user.id)
          .maybeSingle();
        if (adminLookup) {
          setAdminUser({ id: adminLookup.id, email: adminLookup.email });
        }
      } catch {
        await supabase.auth.signOut();
        clearAdminAuthCache();
        if (typeof window !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
        }
        setLoading(false);
        router.push('/admin/login');
      }
    }

    verifyAdmin();

    return () => { cancelled = true; };
  }, [activePath, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
        <div className="text-center px-6">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 text-sm font-medium">Verifying admin access...</p>
          {stalled && (
            <div className="mt-5 max-w-sm mx-auto">
              <p className="text-xs text-slate-500">
                This is taking longer than expected. Your connection may have dropped.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 text-sm font-semibold transition cursor-pointer whitespace-nowrap"
                >
                  Try again
                </button>
                <button
                  onClick={() => router.push('/admin/login')}
                  className="px-4 py-2 rounded-lg border border-slate-600 hover:border-slate-400 text-slate-300 text-sm font-medium transition cursor-pointer whitespace-nowrap"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthorized && !isPublicAdminPath) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
        <div className="text-center px-6">
          <p className="text-slate-400 text-sm font-medium">Your admin session is not active.</p>
          <button
            onClick={() => router.push('/admin/login')}
            className="mt-4 px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 text-sm font-semibold transition cursor-pointer whitespace-nowrap"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (!showSidebar) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-[#0B1933]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
      <AdminSessionTimeout />
      {adminUser && (
        <AdminSessionHeartbeat adminUserId={adminUser.id} adminEmail={adminUser.email} />
      )}
    </div>
  );
}
