'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';

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
}

const ClientAuthContext = createContext<ClientAuthContextType>({
  user: null,
  userId: null,
  clientId: null,
  companyName: 'Client',
  subscriptionTier: 'Free',
  isLoaded: false,
  setAuth: () => {},
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

  return (
    <ClientAuthContext.Provider value={{ ...state, setAuth }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  return useContext(ClientAuthContext);
}