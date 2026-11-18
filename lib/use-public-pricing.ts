'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPublicPricing, type PublicPricing } from '@/lib/public-pricing';

export function usePublicPricing() {
  const [catalogue, setCatalogue] = useState<PublicPricing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setCatalogue(null);
    fetchPublicPricing(supabase).then(data => { if (active) setCatalogue(data); })
      .catch(() => { if (active) setError('Current pricing could not be confirmed. Please retry or contact support.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return { plans: catalogue?.plans ?? [], feesError: catalogue?.feesError ?? false,
    retrievedAt: catalogue?.retrievedAt ?? null, error, loading, retry: () => setAttempt(value => value + 1) };
}
