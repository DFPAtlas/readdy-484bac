'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface ClientAuthState {
  user: User | null;
  userId: string | null;
  clientId: string | null;
  companyName: string;
  subscriptionTier: string;
  isLoaded: boolean;
}

interface ClientAuthContextType extends ClientAuthState {
  setAuth: (data: { user: User; clientId: string; companyName: string; subscriptionTier: string }) => void;
  clearAuth: () => void;
}

const ClientAuthContext = createContext<ClientAuthContextType>({
  user: null,
  userId: null,
  clientId: null,
  companyName: 'Client',
  subscriptionTier: 'Free',
  isLoaded: false,
  setAuth: () => {},
  clearAuth: () => {},
});

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClientAuthState>({
    user: null,
    userId: null,
    clientId: null,
    companyName: 'Client',
    subscriptionTier: 'Free',
    isLoaded: false,
  });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setState(prev => ({ ...prev, isLoaded: true }));
        return;
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      setState({
        user,
        userId: user.id,
        clientId: clientData?.id || null,
        companyName: clientData?.company_name || clientData?.contact_name || 'Client',
        subscriptionTier: clientData?.subscription_tier || 'Free',
        isLoaded: true,
      });
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          userId: null,
          clientId: null,
          companyName: 'Client',
          subscriptionTier: 'Free',
          isLoaded: true,
        });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          supabase.from('clients').select('id, company_name, contact_name, subscription_tier').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
            setState({
              user: session.user,
              userId: session.user.id,
              clientId: data?.id || null,
              companyName: data?.company_name || data?.contact_name || 'Client',
              subscriptionTier: data?.subscription_tier || 'Free',
              isLoaded: true,
            });
          });
        }
      }
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const setAuth = useCallback((data: { user: User; clientId: string; companyName: string; subscriptionTier: string }) => {
    setState({
      user: data.user,
      userId: data.user.id,
      clientId: data.clientId,
      companyName: data.companyName || 'Client',
      subscriptionTier: data.subscriptionTier || 'Free',
      isLoaded: true,
    });
  }, []);

  const clearAuth = useCallback(() => {
    setState({
      user: null,
      userId: null,
      clientId: null,
      companyName: 'Client',
      subscriptionTier: 'Free',
      isLoaded: true,
    });
  }, []);

  return (
    <ClientAuthContext.Provider value={{ ...state, setAuth, clearAuth }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  return useContext(ClientAuthContext);
}