'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientPaymentMethodState, loadClientPaymentMethod } from '@/lib/client-payment-method';

export function useClientPaymentMethod(clientId: string | null) {
  const [stored, setStored] = useState<{ clientId: string | null; state: ClientPaymentMethodState }>({ clientId: null, state: { status: 'loading' } });
  const request = useRef(0);
  const mounted = useRef(false);
  const invalidate = useCallback(() => { request.current++; }, []);
  const refresh = useCallback(async () => {
    if (!clientId || !mounted.current) return;
    const current = ++request.current;
    setStored({ clientId, state: { status: 'loading' } });
    try {
      const result = await loadClientPaymentMethod(supabase);
      if (mounted.current && request.current === current) setStored({ clientId, state: { status: 'checked', result } });
    } catch {
      if (mounted.current && request.current === current) setStored({ clientId, state: { status: 'error' } });
    }
  }, [clientId]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    // The billing portal opens another tab; refresh on returning to this page.
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { mounted.current = false; invalidate(); window.removeEventListener('focus', onFocus); };
  }, [refresh, invalidate]);
  return { state: stored.clientId === clientId ? stored.state : { status: 'loading' } as ClientPaymentMethodState, refresh };
}
