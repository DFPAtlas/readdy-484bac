import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from './useSafeRouter';
import { useClientAuth } from '@/lib/ClientAuthContext';

const CLIENT_OPEN_PATHS = ['/client/complete-profile-wizard', '/client/profile', '/client/onboarding'];

export function useClientGuard() {
  const router = useSafeRouter();
  const pathname = usePathname();
  const { isLoaded, userId, clientId, companyName, subscriptionTier } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [clientData, setClientData] = useState<{ id: string; contact_name: string; email: string; phone: string; company_name: string; subscription_tier: string } | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const check = async () => {
      if (
        CLIENT_OPEN_PATHS.some(p => pathname === p) ||
        pathname.startsWith('/payment/') ||
        pathname.startsWith('/client/payment/')
      ) {
        setLoading(false);
        setAllowed(true);
        return;
      }

      if (!userId) {
        router.push('/client/login');
        return;
      }

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (adminData) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      if (!clientId) {
        router.push('/client/complete-profile-wizard');
        return;
      }

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, contact_name, email, phone, company_name, subscription_tier, profile_completed, subscription_status, is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (!clientRow) {
        router.push('/client/complete-profile-wizard');
        return;
      }

      if (!clientRow.profile_completed) {
        router.push('/client/complete-profile-wizard');
        return;
      }

      if (clientRow.is_active === false) {
        router.push('/client/support');
        return;
      }

      setClientData({
        id: clientRow.id,
        contact_name: clientRow.contact_name,
        email: clientRow.email,
        phone: clientRow.phone,
        company_name: clientRow.company_name,
        subscription_tier: clientRow.subscription_tier,
      });
      setAllowed(true);
      setLoading(false);
    };

    check();
  }, [pathname, router, userId, clientId, isLoaded, companyName, subscriptionTier]);

  return { loading, allowed, userId, clientData };
}