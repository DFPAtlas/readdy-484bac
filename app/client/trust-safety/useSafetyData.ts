import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { loadClientSafetyData } from '@/lib/client-safety-data';

interface SafetyCheck {
  id: string;
  job_id: string;
  client_id: string;
  site_address_confirmed: boolean;
  site_contact_available: boolean;
  emergency_contact_added: boolean;
  site_access_instructions_added: boolean;
  risk_notes_added: boolean;
  lone_worker_flagged: boolean;
  parking_details_added: boolean;
  required_sia_selected: boolean;
  created_at: string;
  updated_at: string;
}

interface JobWithSafety {
  id: string;
  job_title: string;
  venue_name: string;
  venue_address_line1: string;
  venue_city: string;
  venue_postcode: string;
  status: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  risk_level: string | null;
  lone_worker_flag: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  out_of_hours_contact_name: string | null;
  out_of_hours_contact_phone: string | null;
  site_access_instructions: string | null;
  parking_instructions: string | null;
  patrol_expectations: string | null;
  cctv_details: string | null;
  emergency_process: string | null;
  special_instructions: string | null;
  dress_code: string | null;
  uniform_required: boolean;
  uniform_details: string | null;
  sia_licence_required: boolean;
  required_license_type: string | null;
  required_licence_types?: string[] | null;
  specific_licences?: string[] | null;
  is_deleted?: boolean | null;
  assigned_count: number;
  applications_count: number;
  payment_status: string | null;
  safety_check?: SafetyCheck;
}

interface Incident {
  id: string;
  ticket_reference: string | null;
  job_id: string | null;
  category: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  description: string;
}

export interface GuardAssignment {
  id: string;
  guard_id: string;
  status: string;
  guards: {
    id: string;
    full_name: string;
    sia_licence_number: string | null;
    sia_verified: boolean;
    sia_expiry_date: string | null;
    sia_licence_type: string | null;
    licence_types?: string[] | null;
  } | null;
}

export interface SafetyData {
  client: { id: string; company_name: string; contact_name: string } | null;
  jobs: JobWithSafety[];
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useSafetyData(enabled = true): SafetyData {
  const [client, setClient] = useState<SafetyData['client']>(null);
  const [jobs, setJobs] = useState<JobWithSafety[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    let retired = false;
    const request = ++sequence.current;
    const current = () => !retired && request === sequence.current;
    setClient(null); setJobs([]); setIncidents([]); setError(null);
    setLoading(enabled);
    if (enabled) {
      void loadClientSafetyData(supabase).then(result => {
        if (!current()) return;
        setClient(result.client); setJobs(result.jobs); setIncidents(result.incidents);
      }).catch(() => {
        if (current()) setError('Safety records could not be loaded. Please retry.');
      }).finally(() => { if (current()) setLoading(false); });
    }
    return () => { retired = true; };
  }, [enabled, revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  return { client, jobs, incidents, loading, error, retry };
}

export function useUpdateSafetyCheck() {
  return useCallback(async (checkId: string | undefined, jobId: string, clientId: string, updates: Partial<SafetyCheck>) => {
    if (checkId) {
      const { error } = await supabase
        .from('job_safety_checks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', checkId);
      return { error };
    } else {
      const { error } = await supabase
        .from('job_safety_checks')
        .insert({
          job_id: jobId,
          client_id: clientId,
          ...updates,
        });
      return { error };
    }
  }, []);
}

export function useUpdateJobSafety() {
  return useCallback(async (jobId: string, updates: Partial<any>) => {
    const { error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId);
    return { error };
  }, []);
}