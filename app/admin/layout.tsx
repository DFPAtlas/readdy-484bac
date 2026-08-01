"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import AdminSidebar from '@/components/AdminSidebar';
import AdminSessionTimeout from '@/components/AdminSessionTimeout';
import AdminSessionHeartbeat from '@/components/AdminSessionHeartbeat';
import { supabase } from '@/lib/supabase';
import { clearAdminAuthCache } from '@/hooks/useAdminAuth';

const NO_SIDEBAR_PATHS = ['/admin/login', '/admin/setup', '/admin/register'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useSafeRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<{ id: string; email: string } | null>(null);

  const showSidebar = !NO_SIDEBAR_PATHS.includes(pathname);

  useEffect(() => {
    let cancelled = false;

    if (NO_SIDEBAR_PATHS.includes(pathname)) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setIsAuthorized(false);

    async function verifyAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.user) {
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        if (cancelled) return;

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id, role, is_active, full_name, email')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (adminCheck && adminCheck.is_active && ['super_admin', 'admin', 'finance_admin'].includes(adminCheck.role)) {
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

        setIsAuthorized(true);
        setLoading(false);

        const { data: adminLookup } = await supabase
          .from('admin_users')
          .select('id, email')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (adminLookup) {
          setAdminUser({ id: adminLookup.id, email: adminLookup.email });
        }
      } catch (err) {
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
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 text-sm font-medium">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized && !NO_SIDEBAR_PATHS.includes(pathname)) {
    return null;
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