'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { withRequestDeadline } from './request-deadline';
interface AuthInput { user: User; clientId: string; companyName: string; subscriptionTier: string; }
interface State { user: User | null; userId: string | null; clientId: string | null; companyName: string; subscriptionTier: string; isLoaded: boolean; authError: string | null; }
interface Context extends State { setAuth: (data: AuthInput) => void; clearAuth: () => void; retryAuth: () => void; reportAuthError: (message: string) => void; }
const blank: State = { user: null, userId: null, clientId: null, companyName: 'Client', subscriptionTier: 'Free', isLoaded: false, authError: null };
const ClientAuthContext = createContext<Context>({ ...blank, setAuth() {}, clearAuth() {}, retryAuth() {}, reportAuthError() {} });
export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(blank);
  const generation = useRef(0), mounted = useRef(false), owner = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const current = () => mounted.current && generation.current === request;
    setState(previous => ({ ...previous, isLoaded: false, authError: null }));
    try {
      const session = await withRequestDeadline(supabase.auth.getSession());
      if (!current()) return;
      if (session.error) throw session.error;
      if (!session.data.session) { owner.current = null; setState({ ...blank, isLoaded: true }); return; }
      const auth = await withRequestDeadline(supabase.auth.getUser());
      if (!current()) return;
      if (auth.error) throw auth.error;
      const user = auth.data.user; owner.current = user?.id || null;
      if (!user) { setState({ ...blank, isLoaded: true }); return; }
      setState(previous => previous.userId === user.id ? { ...previous, user } : { ...blank, user, userId: user.id });
      const profile = await withRequestDeadline(supabase.from('clients').select('id, company_name, contact_name, subscription_tier').eq('user_id', user.id).maybeSingle());
      if (!current()) return;
      if (profile.error) throw profile.error;
      setState({ user, userId: user.id, clientId: profile.data?.id || null, companyName: profile.data?.company_name || profile.data?.contact_name || 'Client', subscriptionTier: profile.data?.subscription_tier || 'Free', isLoaded: true, authError: null });
    } catch {
      if (current()) setState(previous => ({ ...previous, clientId: null, isLoaded: true, authError: 'Your account could not be verified. Please retry.' }));
    }
  }, []);
  const clearAuth = useCallback(() => { ++generation.current; owner.current = null; if (mounted.current) setState({ ...blank, isLoaded: true }); }, []);
  const setAuth = useCallback((data: AuthInput) => {
    const request = generation.current;
    void withRequestDeadline(supabase.auth.getUser()).then(auth => {
      if (!mounted.current || generation.current !== request) return;
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== data.user.id) return;
      ++generation.current;
      owner.current = data.user.id; setState({ ...data, userId: data.user.id, isLoaded: true, authError: null });
    }).catch(() => {
      if (mounted.current && generation.current === request) setState(previous => ({ ...previous, isLoaded: true, authError: 'Your account could not be verified. Please retry.' }));
    });
  }, []);
  const reportAuthError = useCallback((message: string) => { if (mounted.current) setState(previous => ({ ...previous, authError: message })); }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return;
      if (event === 'SIGNED_OUT' || !session?.user) { clearAuth(); return; }
      const changed = session.user.id !== owner.current;
      if (changed) { ++generation.current; owner.current = session.user.id; setState({ ...blank, user: session.user, userId: session.user.id }); }
      // Run after the auth callback releases Supabase's internal session lock.
      if (event !== 'TOKEN_REFRESHED' || changed) queueMicrotask(() => { if (mounted.current) void refresh(); });
    });
    return () => { mounted.current = false; data.subscription.unsubscribe(); };
  }, [refresh, clearAuth]);
  return <ClientAuthContext.Provider value={{ ...state, setAuth, clearAuth, retryAuth: refresh, reportAuthError }}>
    {state.authError ? <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p>{state.authError}</p><button onClick={() => void refresh()} className="rounded-lg bg-teal-600 px-5 py-2 text-white">Retry account verification</button>
      <button onClick={() => void supabase.auth.signOut()} className="underline">Sign out</button>
    </div> : children}
  </ClientAuthContext.Provider>;
}
export function useClientAuth() { return useContext(ClientAuthContext); }
