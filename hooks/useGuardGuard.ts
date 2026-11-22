import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { withRequestDeadline } from '@/lib/request-deadline';

interface GuardAccess {
  loading: boolean;
  allowed: boolean;
  userId: string | null;
  roleSwitch: 'client' | 'guard' | null;
  verificationStatus: string | null;
  error: string | null;
}

const checking: GuardAccess = {
  loading: true, allowed: false, userId: null, roleSwitch: null,
  verificationStatus: null, error: null,
};
const unavailable = 'Your guard access could not be verified. Please retry.';

export function useGuardGuard() {
  const [access, setAccess] = useState<GuardAccess>(checking);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let retired = false;
    let generation = 0;
    let owner: string | null = null;
    let verified = false;
    let scheduled: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      const request = ++generation;
      const current = () => !retired && request === generation;
      verified = false;
      if (current()) setAccess(checking);
      try {
        const auth = await withRequestDeadline(supabase.auth.getUser());
        if (!current()) return;
        if (auth.error) throw new Error(unavailable);
        const user = auth.data.user;
        if (!user) {
          owner = null;
          setAccess({ ...checking, loading: false, error: 'Your session is unavailable. Sign in again to continue.' });
          return;
        }
        owner = user.id;
        const guard = await withRequestDeadline(supabase.from('guards')
          .select('id, verification_status').eq('user_id', user.id).maybeSingle());
        if (!current()) return;
        if (guard.error) throw new Error(unavailable);
        let roleSwitch: GuardAccess['roleSwitch'] = guard.data ? 'guard' : null;
        if (!guard.data) {
          const client = await withRequestDeadline(supabase.from('clients').select('id').eq('user_id', user.id).maybeSingle());
          if (!current()) return;
          if (client.error) throw new Error(unavailable);
          if (client.data) roleSwitch = 'client';
        }
        const confirmed = await withRequestDeadline(supabase.auth.getUser());
        if (!current()) return;
        if (confirmed.error || confirmed.data.user?.id !== user.id) throw new Error(unavailable);
        verified = roleSwitch === 'guard';
        setAccess({ loading: false, allowed: verified, userId: user.id, roleSwitch,
          verificationStatus: guard.data?.verification_status || null,
          error: roleSwitch ? null : 'Your guard profile could not be found. Retry or sign in with your guard account.' });
      } catch {
        if (current()) setAccess({ ...checking, loading: false, error: unavailable });
      }
    };

    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (retired) return;
      if (event === 'INITIAL_SESSION' && (!session?.user || session.user.id === owner)) return;
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && verified && session?.user.id === owner) return;
      // Retire access synchronously. SDK calls run after the auth callback releases its lock.
      generation++;
      verified = false;
      owner = session?.user.id || null;
      if (scheduled !== null) clearTimeout(scheduled);
      if (!owner) {
        setAccess({ ...checking, loading: false, error: 'Your session is unavailable. Sign in again to continue.' });
        return;
      }
      setAccess(checking);
      scheduled = setTimeout(() => { scheduled = null; void check(); }, 0);
    });

    return () => {
      retired = true;
      generation++;
      if (scheduled !== null) clearTimeout(scheduled);
      subscription.unsubscribe();
    };
  }, [attempt]);

  return { ...access, retry: () => { setAccess(checking); setAttempt(value => value + 1); } };
}
