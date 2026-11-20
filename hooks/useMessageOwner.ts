import { useEffect, useRef, useState } from 'react';
import { withRequestDeadline } from '@/lib/request-deadline';
import { supabase } from '@/lib/supabase';
export function useMessageOwner() {
  const [identity, setIdentity] = useState({ id: null as string | null, revision: 0, ready: false, error: false });
  const [retry, setRetry] = useState(0); const generation = useRef(0);
  useEffect(() => {
    let active = true; const request = ++generation.current;
    void withRequestDeadline(supabase.auth.getUser()).then(result => {
      if (!active || request !== generation.current) return;
      setIdentity(previous => ({ id: result.data.user?.id || null, revision: previous.revision + (previous.id !== result.data.user?.id ? 1 : 0), ready: true, error: !!result.error }));
    }).catch(() => { if (active && request === generation.current) setIdentity(previous => ({ ...previous, id: null, ready: true, error: true })); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return; ++generation.current; const id = session?.user?.id || null;
      setIdentity(previous => ({ id, revision: previous.revision + (previous.id !== id ? 1 : 0), ready: true, error: false }));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [retry]);
  return { ...identity, retry: () => setRetry(n => n + 1) };
}
