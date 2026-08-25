'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ApplicantRow {
  id: string;
  guard_id: string;
  status: string;
  cover_letter: string | null;
  created_at: string;
  guards: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    sia_licence_number: string | null;
    licence_types: string[] | null;
    years_experience: number | null;
    verification_status: string | null;
  } | null;
}

async function invokeEdgeFunction(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-job-mutate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function useJobApplicants() {
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplicants = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: appData, error: appErr } = await supabase
        .from('job_applications')
        .select('id, guard_id, status, cover_letter, cover_message, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (appErr) throw appErr;

      const guardIds = (appData || []).map((a: any) => a.guard_id).filter(Boolean);
      let guardMap: Record<string, any> = {};
      if (guardIds.length > 0) {
        const { data: guardsData } = await supabase
          .from('guards')
          .select('id, full_name, email, phone, sia_licence_number, licence_types, years_experience, verification_status')
          .in('id', guardIds);
        (guardsData || []).forEach((g: any) => { guardMap[g.id] = g; });
      }

      const enriched = (appData || []).map((a: any) => ({
        ...a,
        cover_letter: a.cover_letter || a.cover_message || null,
        guards: guardMap[a.guard_id] || null,
      }));

      setApplicants(enriched as ApplicantRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearApplicants = useCallback(() => {
    setApplicants([]);
    setError(null);
  }, []);

  const acceptApplicant = async (applicationId: string, jobId: string, guardId: string) => {
    await invokeEdgeFunction('accept_applicant', { applicationId, jobId, guardId });
    setApplicants(prev => prev.map(a => a.id === applicationId ? { ...a, status: 'accepted' } : a));
  };

  const declineApplicant = async (applicationId: string, jobId: string, guardId: string) => {
    await invokeEdgeFunction('decline_applicant', { applicationId, jobId, guardId });
    setApplicants(prev => prev.map(a => a.id === applicationId ? { ...a, status: 'declined' } : a));
  };

  return {
    applicants,
    loading,
    error,
    fetchApplicants,
    clearApplicants,
    acceptApplicant,
    declineApplicant,
  };
}