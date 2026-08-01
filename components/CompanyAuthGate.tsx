'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function CompanyAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) router.push('/company/login');
        return;
      }

      const { data: company } = await supabase
        .from('companies')
        .select('id, profile_completed, verification_status, subscription_status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!company) {
        if (!cancelled) router.push('/guard/register');
        return;
      }

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/provision-user-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ userId: session.user.id, accountType: 'company' }),
        });
      } catch {}

      if (!cancelled) {
        setAllowed(true);
        setLoading(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}