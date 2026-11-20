import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from './useSafeRouter';
import { withRequestDeadline } from '@/lib/request-deadline';
import { useClientAuth } from '@/lib/ClientAuthContext';
const CLIENT_OPEN_PATHS = ['/client/complete-profile-wizard', '/client/profile', '/client/onboarding'];
type ClientData = { id: string; contact_name: string; email: string; phone: string; company_name: string; subscription_tier: string };
export function useClientGuard() {
  const router = useSafeRouter(), pathname = usePathname();
  const { isLoaded, userId, clientId, companyName, subscriptionTier, authError, reportAuthError } = useClientAuth();
  const key = JSON.stringify([pathname, userId, clientId, isLoaded, companyName, subscriptionTier]);
  const [result, setResult] = useState<{ key: string; allowed: boolean; clientData: ClientData | null; error: string | null } | null>(null);
  useEffect(() => {
    let retired = false;
    const finish = (allowed: boolean, clientData: ClientData | null = null, error: string | null = null) => { if (!retired) setResult({ key, allowed, clientData, error }); };
    if (!isLoaded || authError) return;
    const check = async () => {
      try {
        if (!userId) { finish(false); router.replace('/client/login'); return; }
        const auth = await withRequestDeadline(supabase.auth.getUser()); if (retired) return;
        if (auth.error || auth.data.user?.id !== userId) throw new Error('Account changed');
        if (CLIENT_OPEN_PATHS.includes(pathname) || pathname.startsWith('/client/payment/')) { finish(true); return; }
        const admin = await withRequestDeadline(supabase.rpc('is_active_admin')); if (retired) return;
        if (admin.error) throw admin.error;
        if (typeof admin.data !== 'boolean') throw new Error('Admin verification unavailable');
        if (admin.data) { finish(true); return; }
        if (!clientId) { finish(false); router.replace('/client/complete-profile-wizard'); return; }
        const profile = await withRequestDeadline(supabase.from('clients').select('id, contact_name, email, phone, company_name, subscription_tier, profile_completed, is_active, is_suspended').eq('user_id', userId).eq('id', clientId).maybeSingle()); if (retired) return;
        if (profile.error) throw profile.error;
        if (!profile.data || !profile.data.profile_completed) { finish(false); router.replace('/client/complete-profile-wizard'); return; }
        if (profile.data.is_active === false || profile.data.is_suspended === true) { finish(false); router.replace('/client/account-status'); return; }
        finish(true, profile.data);
      } catch {
        if (!retired) { const message = 'Your client access could not be verified. Please retry.'; finish(false, null, message); reportAuthError(message); }
      }
    }; void check();
    return () => { retired = true; };
  }, [key, pathname, userId, clientId, isLoaded, authError, reportAuthError, router]);
  const current = result?.key === key && !authError;
  return { loading: !isLoaded || (!current && !authError), allowed: !!current && !!result?.allowed, userId, clientData: current ? result?.clientData || null : null, error: authError || (current ? result?.error : null) };
}
