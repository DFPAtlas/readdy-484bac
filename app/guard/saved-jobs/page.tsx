'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';

interface SavedJob {
  id: string;
  saved_at: string;
  notes: string | null;
  jobs: {
    id: string;
    job_title: string;
    security_type: string;
    venue_name: string;
    venue_city: string;
    venue_postcode: string;
    start_date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    status: string;
    sia_licence_required: boolean;
    number_of_guards: number;
    clients: { company_name: string } | null;
  } | null;
}

export default function GuardSavedJobsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [applications, setApplications] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/guard/login'); return; }

    const { data: guard } = await supabase
      .from('guards')
      .select('id, full_name, verification_status, licence_types')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) { router.push('/guard/login'); return; }
    if (guard.verification_status !== 'approved' && guard.verification_status !== 'verified') { router.push('/guard/onboarding'); return; }

    setGuardId(guard.id);
    setGuardName(guard.full_name);

    const { data: saved } = await supabase
      .from('saved_jobs')
      .select(`
        id, saved_at, notes,
        jobs (
          id, job_title, security_type, venue_name, venue_city, venue_postcode,
          start_date, start_time, end_time, hourly_rate, status, sia_licence_required,
          number_of_guards,
          clients ( company_name )
        )
      `)
      .eq('guard_id', guard.id)
      .order('saved_at', { ascending: false });

    setSavedJobs((saved || []) as any);

    const { data: apps } = await supabase
      .from('job_applications')
      .select('job_id')
      .eq('guard_id', guard.id);

    setApplications(new Set((apps || []).map((a: any) => a.job_id)));
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const unsave = async (savedId: string, jobId: string) => {
    setRemoving(savedId);
    await supabase.from('saved_jobs').delete().eq('id', savedId);
    setSavedJobs(prev => prev.filter(s => s.id !== savedId));
    showToast('Job removed from saved list', 'info');
    setRemoving(null);
  };

  const apply = async (jobId: string) => {
    if (!guardId) return;
    setApplying(jobId);
    try {
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('status')
        .eq('id', jobId)
        .maybeSingle();
      if (!jobRow || jobRow.status !== 'open') {
        showToast('This job is no longer accepting applications.', 'error');
        setApplying(null);
        return;
      }

      const limitCheck = await checkGuardApplicationLimit(supabase, guardId);
      if (!limitCheck.allowed) {
        if (limitCheck.reason === 'limit_reached') {
          showToast('You have reached your monthly application limit for your current plan. Upgrade your plan to apply for more jobs this month.', 'error');
          router.push('/upgrade?reason=guard_application_limit_reached');
        } else {
          showToast('We could not verify your guard subscription plan. Please refresh or contact support.', 'error');
          router.push('/upgrade?reason=guard.plan_verification_failed');
        }
        setApplying(null);
        return;
      }

      const { error } = await supabase
        .from('job_applications')
        .insert({
          job_id: jobId,
          guard_id: guardId,
          status: 'pending',
          cover_message: '',
          applied_at: new Date().toISOString(),
        });

      if (error) {
        if (error.code === '23505') {
          showToast('Already applied to this job', 'info');
          setApplications(prev => new Set([...prev, jobId]));
        } else {
          showToast('Failed to apply. Please try again.', 'error');
        }
      } else {
        setApplications(prev => new Set([...prev, jobId]));
        showToast('Application submitted!', 'success');
      }
    } catch {
      showToast('Failed to apply. Please try again.', 'error');
    } finally {
      setApplying(null);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'open') return 'text-emerald-400';
    if (status === 'filled' || status === 'completed') return 'text-slate-400';
    return 'text-amber-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      <PortalSidebar
        role="guard"
        displayName={guardName}
        subtitle="Verified"
        initials={guardName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        accentColor="emerald"
      />

      <div className="flex-1 lg:ml-72 min-h-screen pt-16 lg:pt-8 pb-24 px-4 sm:px-8">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            <i className={toast.type === 'success' ? 'ri-checkbox-circle-line' : toast.type === 'error' ? 'ri-error-warning-line' : 'ri-information-line'}></i>
            {toast.msg}
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/guard/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Saved Jobs</h1>
              <p className="text-sm text-slate-500">{savedJobs.length} saved job{savedJobs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {savedJobs.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-bookmark-line text-3xl text-slate-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">No saved jobs yet</h3>
              <p className="text-slate-500 text-sm mb-6">Browse jobs and save the ones you like to apply later.</p>
              <Link href="/jobs" className="inline-flex items-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap">
                <i className="ri-search-line"></i>Browse Jobs
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {savedJobs.map(saved => {
                const job = saved.jobs;
                if (!job) return null;
                const alreadyApplied = applications.has(job.id);
                const isClosed = job.status !== 'open';
                return (
                  <div key={saved.id} className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5 hover:border-teal-500/20 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-lg font-semibold text-white">{job.job_title}</h3>
                          <span className={`text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status === 'open' ? '● Open' : '● ' + job.status}
                          </span>
                          {job.sia_licence_required && (
                            <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">SIA Required</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-3">{job.clients?.company_name || 'Private Client'}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><i className="ri-map-pin-line text-slate-500"></i>{job.venue_city}</span>
                          <span className="flex items-center gap-1"><i className="ri-calendar-line text-slate-500"></i>{new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span className="flex items-center gap-1"><i className="ri-time-line text-slate-500"></i>{job.start_time} – {job.end_time}</span>
                          <span className="flex items-center gap-1 font-semibold text-teal-400"><i className="ri-money-pound-circle-line"></i>£{Number(job.hourly_rate).toFixed(2)}/hr</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-3">Saved {new Date(saved.saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Link href={`/jobs/${job.id}`} className="px-4 py-2 bg-[#162036] text-slate-300 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap text-center">
                          View Job
                        </Link>
                        {!isClosed && (
                          alreadyApplied ? (
                            <button disabled className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-xl border border-emerald-500/20 whitespace-nowrap cursor-not-allowed">
                              Applied ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => apply(job.id)}
                              disabled={applying === job.id}
                              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              {applying === job.id ? 'Applying...' : 'Apply Now'}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => unsave(saved.id, job.id)}
                          disabled={removing === saved.id}
                          className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                          {removing === saved.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}