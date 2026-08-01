import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function useGuardGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [roleSwitch, setRoleSwitch] = useState<'client' | 'guard' | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: guardData } = await supabase
        .from('guards')
        .select('id, verification_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (guardData) {
        if (!cancelled) {
          setVerificationStatus(guardData.verification_status || null);
          setAllowed(true);
          setRoleSwitch('guard');
          setLoading(false);
        }
        return;
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (clientData) {
        if (!cancelled) {
          setRoleSwitch('client');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setAllowed(false);
        setLoading(false);
      }
    };

    check();

    return () => { cancelled = true; };
  }, []);

  return { loading, allowed, roleSwitch, verificationStatus };
}