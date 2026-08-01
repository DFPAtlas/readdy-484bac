import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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
  assigned_count: number;
  applications_count: number;
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

interface SafetyCounts {
  totalJobs: number;
  missingSafetyInfo: number;
  highRiskJobs: number;
  complianceWarnings: number;
  missingEmergencyContacts: number;
  missingSiteInstructions: number;
  jobsWithSIARequired: number;
  jobsLoneWorker: number;
  jobsWithIncidents: number;
  openTickets: number;
  urgentTickets: number;
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
  } | null;
}

export interface SafetyData {
  jobs: JobWithSafety[];
  incidents: Incident[];
  counts: SafetyCounts;
  loading: boolean;
  error: string | null;
}

export function useSafetyData(): SafetyData {
  const [jobs, setJobs] = useState<JobWithSafety[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientData) {
        setError('Client not found');
        setLoading(false);
        return;
      }

      const clientId = clientData.id;

      const [jobsRes, safetyRes, ticketsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('job_safety_checks')
          .select('*')
          .eq('client_id', clientId),
        supabase
          .from('support_tickets')
          .select('id, ticket_reference, job_id, category, subject, priority, status, created_at, resolved_at, description')
          .eq('client_id', clientId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
      ]);

      const jobsData = (jobsRes.data || []) as any[];
      const safetyChecks = (safetyRes.data || []) as SafetyCheck[];
      const ticketsData = (ticketsRes.data || []) as Incident[];

      const safetyMap: Record<string, SafetyCheck> = {};
      safetyChecks.forEach((s) => {
        safetyMap[s.job_id] = s;
      });

      const jobsWithSafety: JobWithSafety[] = jobsData.map((j) => ({
        ...j,
        safety_check: safetyMap[j.id],
      }));

      setJobs(jobsWithSafety);
      setIncidents(ticketsData);
    } catch (e: any) {
      setError(e.message || 'Failed to load safety data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts: SafetyCounts = (() => {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    let missingSafetyInfo = 0;
    let highRiskJobs = 0;
    let complianceWarnings = 0;
    let missingEmergencyContacts = 0;
    let missingSiteInstructions = 0;
    let jobsLoneWorker = 0;

    jobs.forEach((job) => {
      const sc = job.safety_check;
      const hasSafetyCheck = !!sc;
      const isSoon = job.start_date && new Date(job.start_date) <= in48h && new Date(job.start_date) >= now;

      if (job.risk_level === 'high' || job.risk_level === 'urgent') {
        highRiskJobs++;
      }
      if (job.lone_worker_flag) {
        jobsLoneWorker++;
      }
      if (!job.emergency_contact_name && !job.emergency_contact_phone) {
        missingEmergencyContacts++;
      }
      if (!job.site_access_instructions && !job.parking_instructions && !job.special_instructions) {
        missingSiteInstructions++;
      }

      const checklist = sc || {
        site_address_confirmed: false,
        site_contact_available: false,
        emergency_contact_added: false,
        site_access_instructions_added: false,
        risk_notes_added: false,
        lone_worker_flagged: false,
        parking_details_added: false,
        required_sia_selected: false,
      };

      const completed = Object.values(checklist).filter(Boolean).length;
      const total = 8;
      if (completed < total) {
        missingSafetyInfo++;
      }

      if (isSoon && !hasSafetyCheck) {
        complianceWarnings++;
      }
      if (job.sia_licence_required && !sc?.required_sia_selected) {
        complianceWarnings++;
      }
      if (job.lone_worker_flag && !sc?.lone_worker_flagged) {
        complianceWarnings++;
      }
    });

    const jobsWithIncidents = new Set(incidents.filter((i) => i.job_id).map((i) => i.job_id)).size;

    return {
      totalJobs: jobs.length,
      missingSafetyInfo,
      highRiskJobs,
      complianceWarnings,
      missingEmergencyContacts,
      missingSiteInstructions,
      jobsWithSIARequired: jobs.filter((j) => j.sia_licence_required).length,
      jobsLoneWorker,
      jobsWithIncidents,
      openTickets: incidents.filter((i) => i.status !== 'closed' && i.status !== 'resolved').length,
      urgentTickets: incidents.filter((i) => i.priority === 'urgent' && i.status !== 'closed' && i.status !== 'resolved').length,
    };
  })();

  return { jobs, incidents, counts, loading, error };
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