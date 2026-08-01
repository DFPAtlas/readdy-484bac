'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import MaintenanceWrapper from '@/components/MaintenanceWrapper';
import RealtimeToast from '@/components/RealtimeToast';
import CookieConsent from '@/components/CookieConsent';
import QGExitIntentPopup from '@/components/qg-rewards/QGExitIntentPopup';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(false);
  const pathname = usePathname();
  const router = useSafeRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      mountedRef.current = true;
      setMounted(true);
    }, 300);
    return () => {
      clearTimeout(t);
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (
          pathname &&
          !pathname.startsWith('/admin') &&
          pathname !== '/' &&
          !pathname.startsWith('/client/login') &&
          !pathname.startsWith('/guard/login') &&
          !pathname.startsWith('/auth') &&
          !pathname.startsWith('/subscription') &&
          !pathname.startsWith('/payment') &&
          !pathname.startsWith('/security-guards') &&
          !pathname.startsWith('/jobs') &&
          !pathname.startsWith('/pricing') &&
          !pathname.startsWith('/how-it-works') &&
          !pathname.startsWith('/contact') &&
          !pathname.startsWith('/help') &&
          !pathname.startsWith('/terms') &&
          !pathname.startsWith('/privacy') &&
          !pathname.startsWith('/cookie-policy') &&
          !pathname.startsWith('/find-a-guard') &&
          !pathname.startsWith('/post-job') &&
          !pathname.startsWith('/mobile-app') &&
          !pathname.startsWith('/security-for') &&
          !pathname.startsWith('/founding-guards') &&
          !pathname.startsWith('/guide') &&
          !pathname.startsWith('/company') &&
          !pathname.startsWith('/maintenance') &&
          !pathname.startsWith('/upgrade') &&
          !pathname.startsWith('/accessibility')
        ) {
          router.push('/');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (!mountedRef.current) return;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason?.message === 'string' ? reason.message : String(reason);
      if (
        message.includes('Invalid Refresh Token') ||
        message.includes('Refresh Token Not Found') ||
        message.includes('invalid refresh token')
      ) {
        event.preventDefault();
        supabase.auth.signOut().then(() => {
          if (
            pathname &&
            !pathname.startsWith('/auth') &&
            !pathname.startsWith('/client/login') &&
            !pathname.startsWith('/guard/login') &&
            !pathname.startsWith('/client/register') &&
            !pathname.startsWith('/guard/register') &&
            !pathname.startsWith('/admin')
          ) {
            const isClient = pathname.startsWith('/client');
            const isGuard = pathname.startsWith('/guard');
            if (isClient) router.push('/client/login');
            else if (isGuard) router.push('/guard/login');
            else router.push('/');
          }
        });
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [pathname, router]);

  return (
    <>
      <QGExitIntentPopup />
      <MaintenanceWrapper>{children}</MaintenanceWrapper>
      <RealtimeToast />
      <CookieConsent />
    </>
  );
}