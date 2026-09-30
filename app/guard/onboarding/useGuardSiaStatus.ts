'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const POLL_MS = 10000;
const MAX_MS = 180000;
const TERMINAL = ['approved', 'verified', 'rejected', 'manual_review', 'suspended', 'expired'];

export type OnboardingState = 'loading' | 'pending' | 'approved' | 'rejected' | 'review' | 'restricted';

export function useGuardSiaStatus() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>('loading');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [restrictedStatus, setRestrictedStatus] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const stopTimers = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };

    const apply = (g: any) => {
      const vs = g?.verification_status;
      if (vs === 'approved' || vs === 'verified') { stopTimers(); setState('approved'); return; }
      if (vs === 'rejected') { stopTimers(); setRejectionReason(g.rejection_reason || null); setState('rejected'); return; }
      if (vs === 'manual_review') { stopTimers(); setState('review'); return; }
      if (vs === 'suspended' || vs === 'expired') { stopTimers(); setRestrictedStatus(vs); setState('restricted'); return; }
      setState('pending');
    };

    const poll = async () => {
      if (!mountedRef.current || !userIdRef.current) return;
      const { data } = await supabase
        .from('guards')
        .select('verification_status, rejection_reason')
        .eq('user_id', userIdRef.current)
        .maybeSingle();
      if (!mountedRef.current || !data) return;
      apply(data);
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      if (!session?.user) { router.push('/guard/login'); return; }
      userIdRef.current = session.user.id;

      const { data: g } = await supabase
        .from('guards')
        .select('verification_status, rejection_reason, profile_completed')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!mountedRef.current) return;
      if (!g || !g.profile_completed) { router.push('/guard/complete-profile-wizard'); return; }

      apply(g);
      if (TERMINAL.includes(g.verification_status)) return;

      pollRef.current = setInterval(poll, POLL_MS);
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        stopTimers();
        setState(prev => (prev === 'pending' ? 'review' : prev));
      }, MAX_MS);
    };

    init();
    return () => { mountedRef.current = false; stopTimers(); };
  }, []);

  return { state, rejectionReason, restrictedStatus };
}