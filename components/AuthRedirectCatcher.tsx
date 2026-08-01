'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';

export default function AuthRedirectCatcher() {
  const router = useSafeRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || typeof window === 'undefined') return;
    hasRun.current = true;

    const hash = window.location.hash;
    if (!hash) return;

    if (!hash.includes('access_token=') && !hash.includes('error=')) return;

    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const hashError = hashParams.get('error_description');

    if (hashError) return;

    if (!accessToken) return;

    (async () => {
      const { data } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });

      if (!data?.session) return;

      window.history.replaceState({}, document.title, window.location.pathname);

      if (type === 'recovery') {
        const role = data.session.user.user_metadata?.role;
        if (role === 'client') {
          router.replace('/client/reset-password');
        } else {
          router.replace('/guard/reset-password');
        }
        return;
      }

      if (type === 'signup' || type === 'email') {
        const role = data.session.user.user_metadata?.role;
        if (role === 'client') {
          router.replace('/client/dashboard');
        } else {
          router.replace('/guard/dashboard');
        }
        return;
      }
    })();
  }, [router]);

  return null;
}