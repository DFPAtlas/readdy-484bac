import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { loadClientFinanceRecords } from '@/lib/client-finance';

export function useClientFinance() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadClientFinanceRecords>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const mounted = useRef(false);
  const reload = useCallback(async () => {
    const id = ++request.current;
    const current = () => mounted.current && request.current === id;
    if (!current()) return;
    setLoading(true); setError(null); setData(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Sign in to load payment totals.');
      const { data: client, error: clientError } = await supabase.from('clients').select('id').eq('user_id', auth.user.id).maybeSingle();
      if (clientError || !client) throw new Error('Client payment totals are unavailable.');
      const records = await loadClientFinanceRecords(supabase, client.id, auth.user.id);
      if (current()) setData(records);
    } catch { if (current()) setError('Payment totals could not be loaded. Please retry.'); }
    finally { if (current()) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; reload(); return () => { mounted.current = false; }; }, [reload]);
  return { data, loading, error, reload };
}
