'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CLIENT_ACCESS_LOADING,
  clientAccessUnavailable,
  resolveClientAccessPlan,
  type ClientAccessPlan,
} from '@/lib/client-access-plan';

interface ClientAccessResult {
  key: string;
  plan: ClientAccessPlan;
}

export function useClientAccessPlan(enabled: boolean, userId?: string | null): ClientAccessPlan {
  const [result, setResult] = useState<ClientAccessResult | null>(null);
  const lifetimeRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const epochRef = useRef(0);
  const wasEnabledRef = useRef(false);

  if (enabled && !wasEnabledRef.current) epochRef.current += 1;
  wasEnabledRef.current = enabled;

  const contextKey = `${enabled ? 'on' : 'off'}:${userId || 'anonymous'}:${epochRef.current}`;

  useEffect(() => {
    if (!enabled) {
      lifetimeRef.current = null;
      requestRef.current += 1;
      setResult(null);
      return;
    }

    const lifetime = contextKey;
    lifetimeRef.current = lifetime;
    let cancelled = false;
    let inFlight = false;
    let queued = false;
    let identity: string | null | undefined;

    const isCurrent = (token: number) =>
      !cancelled && lifetimeRef.current === lifetime && requestRef.current === token;

    const commit = (plan: ClientAccessPlan) => {
      if (cancelled || lifetimeRef.current !== lifetime) return;
      setResult({ key: lifetime, plan });
    };

    const read = () => {
      const token = ++requestRef.current;
      inFlight = true;
      commit(CLIENT_ACCESS_LOADING);
      resolveClientAccessPlan(userId)
        .then((next) => {
          if (!isCurrent(token)) return;
          inFlight = false;
          commit(next);
        })
        .catch(() => {
          if (!isCurrent(token)) return;
          inFlight = false;
          commit(clientAccessUnavailable());
        });
    };

    const reload = () => {
      requestRef.current += 1;
      inFlight = false;
      commit(CLIENT_ACCESS_LOADING);
      if (queued) return;
      queued = true;
      void Promise.resolve().then(() => {
        queued = false;
        if (cancelled || lifetimeRef.current !== lifetime) return;
        read();
      });
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      const nextIdentity = session?.user?.id ?? null;
      if (event === 'INITIAL_SESSION' && identity === undefined) {
        identity = nextIdentity;
        return;
      }
      const changed = identity !== nextIdentity;
      if (!changed && !inFlight) return;
      identity = nextIdentity;
      reload();
    });

    read();

    return () => {
      cancelled = true;
      requestRef.current += 1;
      if (lifetimeRef.current === lifetime) lifetimeRef.current = null;
      listener?.subscription?.unsubscribe();
    };
  }, [enabled, userId, contextKey]);

  if (!enabled) return CLIENT_ACCESS_LOADING;
  if (!result || result.key !== contextKey || lifetimeRef.current !== contextKey) {
    return CLIENT_ACCESS_LOADING;
  }
  return result.plan;
}