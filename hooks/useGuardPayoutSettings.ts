'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loadGuardPayoutProfile, requestGuardStripe, type GuardPayoutProfile, type GuardStripeAction, type GuardStripeStatus } from '@/lib/guard-payout-settings';

const options = { baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' };

export function useGuardPayoutSettings(enabled: boolean) {
  const [profile, setProfile] = useState<GuardPayoutProfile | null>(null);
  const [status, setStatus] = useState<GuardStripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<GuardStripeAction | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const mounted = useRef(false);
  const request = useRef(0);
  const actionBusy = useRef(false);
  const currentUser = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !mounted.current) return;
    const id = ++request.current;
    const current = () => mounted.current && id === request.current;
    setLoading(true); setRefreshing(false); setBusyAction(null); setProfile(null); setStatus(null); setError(''); setStatusError(''); setActionError(''); setRequiresLogin(false);
    try {
      const guard = await loadGuardPayoutProfile(supabase);
      if (!current()) return;
      if (!guard) { setRequiresLogin(true); return; }
      currentUser.current = guard.userId;
      setProfile(guard);
      try {
        const data = await requestGuardStripe(supabase, 'get-guard-stripe-status', guard.userId, options);
        if (current()) setStatus(data);
      } catch (cause) {
        if (current()) setStatusError(cause instanceof Error ? cause.message : 'Stripe account status could not be loaded.');
      }
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Your payout profile could not be loaded.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    if (enabled) void load();
    else { ++request.current; currentUser.current = null; setProfile(null); setStatus(null); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && currentUser.current && session?.user?.id !== currentUser.current)) {
        ++request.current; currentUser.current = null; setProfile(null); setStatus(null); setLoading(false);
        setBusyAction(null); setRequiresLogin(event === 'SIGNED_OUT');
        setError('Your account has changed. Please refresh this page.');
      }
    });
    return () => { mounted.current = false; currentUser.current = null; subscription.unsubscribe(); };
  }, [enabled, load]);

  const refresh = useCallback(async () => {
    if (!enabled || !profile || !mounted.current || actionBusy.current) return;
    const id = ++request.current;
    const current = () => mounted.current && id === request.current;
    setRefreshing(true); setStatus(null); setStatusError(''); setActionError('');
    try {
      const data = await requestGuardStripe(supabase, 'get-guard-stripe-status', profile.userId, options);
      if (current()) setStatus(data);
    } catch (cause) {
      if (current()) setStatusError(cause instanceof Error ? cause.message : 'Stripe account status could not be loaded.');
    } finally {
      if (current()) setRefreshing(false);
    }
  }, [enabled, profile]);

  const openStripe = useCallback(async (action: GuardStripeAction) => {
    if (!enabled || !profile || !status || refreshing || actionBusy.current || !mounted.current) return;
    if (action === 'create-guard-connect-account' ? status.connected : !status.connected) return;
    const id = request.current;
    actionBusy.current = true; setBusyAction(action); setActionError('');
    try {
      const data = await requestGuardStripe(supabase, action, profile.userId, options);
      if (mounted.current && id === request.current) window.location.assign(data.url);
    } catch (cause) {
      if (mounted.current && id === request.current) setActionError(cause instanceof Error ? cause.message : 'Stripe account link could not be opened.');
    } finally {
      actionBusy.current = false;
      if (mounted.current && id === request.current) setBusyAction(null);
    }
  }, [enabled, profile, status, refreshing]);

  return { profile, status, loading, refreshing, error, statusError, actionError, busyAction, requiresLogin, load, refresh, openStripe };
}
