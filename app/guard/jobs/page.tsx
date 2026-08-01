'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';
import MessageClientModal from '@/app/guard/components/MessageClientModal';

interface JobRow {
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
  required_licence_types: string[] | null;
  urgency: string | null;
  clients: { company_name: string; user_id?: string } | null;
}

export default function GuardJobsPage() {
  const router = useSafeRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [guardLicenceTypes, setGuardLicenceTypes] = useState<string[]>([]);
  const [guardVerificationStatus, setGuardVerificationStatus] = useState('');
  const [applications, setApplications] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredJobs, setFilteredJobs] = useState<JobRow[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [messageModalJob, setMessageModalJob] = useState<JobRow | null>(null);

  const normalizeType = (raw: string | null | undefined): string => {
    if (!raw) return '';
    return raw
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .replace(/\bCctv\b/gi, 'CCTV');
  };

  const availableTypes = Array.from(
    new Map(
      jobs
        .filter(j => j.security_type)
        .map(j => [normalizeType(j.security_type).toLowerCase(), normalizeType(j.security_type)])
    ).values()
  ).sort();

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: guard } = await supabase
      .from('guards')
      .select('id, full_name, verification_status, licence_types')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) return;
    if (guard.verification_status !== 'approved' && guard.verification_status !== 'verified') return;

    setGuardId(guard.id);
    setGuardName(guard.full_name);
    setGuardLicenceTypes(guard.licence_types || []);
    setGuardVerificationStatus(guard.verification_status);

    const { data: jobData } = await supabase
      .from('jobs')
      .select(`
        id, job_title, security_type, venue_name, venue_city, venue_postcode,
        start_date, start_time, end_time, hourly_rate, status, sia_licence_required,
        number_of_guards, required_licence_types, urgency,
        clients ( user_id, company_name )
      `)
      .eq('status', 'open')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);

    setJobs((jobData || []) as any);

    const { data: apps } = await supabase
      .from('job_applications')
      .select('job_id')
      .eq('guard_id', guard.id);
    setApplications(new Set((apps || []).map((a: any) => a.job_id)));

    const { data: saved } = await supabase
      .from('saved_jobs')
      .select('job_id')
      .eq('guard_id', guard.id);
    setSavedIds(new Set((saved || []).map((s: any) => s.job_id)));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let filtered = [...jobs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(j =>
        j.job_title?.toLowerCase().includes(q) ||
        j.venue_city?.toLowerCase().includes(q) ||
        j.clients?.company_name?.toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      const f = typeFilter.toLowerCase();
      filtered = filtered.filter(j => normalizeType(j.security_type).toLowerCase() === f);
    }
    if (sortBy === 'newest') filtered.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    if (sortBy === 'highest') filtered.sort((a, b) => b.hourly_rate - a.hourly_rate);
    if (sortBy === 'soonest') filtered.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    setFilteredJobs(filtered);
  }, [jobs, searchQuery, sortBy, typeFilter]);

  const toggleSave = async (jobId: string) => {
    if (!guardId) return;
    setSavingId(jobId);
    const isSaved = savedIds.has(jobId);
    if (isSaved) {
      const { data: savedRow } = await supabase.from('saved_jobs').select('id').eq('job_id', jobId).eq('guard_id', guardId).maybeSingle();
      if (savedRow) await supabase.from('saved_jobs').delete().eq('id', savedRow.id);
      setSavedIds(prev => { const n = new Set(prev); n.delete(jobId); return n; });
      showToast('Job removed from saved', 'info');
    } else {
      await supabase.from('saved_jobs').insert({ job_id: jobId, guard_id: guardId });
      setSavedIds(prev => new Set([...prev, jobId]));
      showToast('Job saved', 'success');
    }
    setSavingId(null);
  };

  const handleQuickApply = async (job: JobRow) => {
    if (!guardId) return;

    if (guardVerificationStatus !== 'approved' && guardVerificationStatus !== 'verified') {
      showToast('Your profile is not yet verified. You cannot apply for jobs.', 'error');
      return;
    }

    setApplyingId(job.id);

    try {
      if (job.sia_licence_required && job.required_licence_types && job.required_licence_types.length > 0) {
        const hasRequired = job.required_licence_types.some((req: string) =>
          guardLicenceTypes.some((lic: string) => lic.toLowerCase() === req.toLowerCase())
        );
        if (!hasRequired) {
          showToast(`This job requires SIA licence types you do not hold: ${job.required_licence_types.join(', ')}.`, 'error');
          setApplyingId(null);
          return;
        }
      }

      const limitCheck = await checkGuardApplicationLimit(supabase, guardId);
      if (!limitCheck.allowed) {
        if (limitCheck.reason === 'limit_reached') {
          showToast('You have reached your monthly application limit. Upgrade your plan to apply for more jobs.', 'error');
          router.push('/upgrade?reason=guard_application_limit_reached');
        } else {
          showToast('We could not verify your subscription plan. Please refresh or contact support.', 'error');
        }
        setApplyingId(null);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/apply-to-job`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ guardId, jobId: job.id, coverMessage: '' }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.alreadyApplied) {
          showToast('You have already applied to this job.', 'info');
        } else if (result.limitReached) {
          showToast('You have reached your monthly application limit. Upgrade your plan to apply for more jobs.', 'error');
          router.push('/upgrade?reason=guard_application_limit_reached');
        } else if (result.tierLocked) {
          showToast('Your current plan does not allow applying to this job tier. Please upgrade.', 'error');
          router.push('/upgrade?reason=guard.unlimited_applications');
        } else {
          showToast(result.error || 'Failed to apply. Please try again.', 'error');
        }
        setApplyingId(null);
        return;
      }

      setApplications(prev => new Set([...prev, job.id]));
      showToast('Application submitted successfully!', 'success');
    } catch {
      showToast('Failed to apply. Please try again.', 'error');
    } finally {
      setApplyingId(null);
    }
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

        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/guard/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">Find Jobs</h1>
              <p className="text-sm text-slate-500">{filteredJobs.length} open position{filteredJobs.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/guard/saved-jobs" className="flex items-center gap-2 px-4 py-2 bg-[#162036] text-slate-300 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap">
              <i className="ri-bookmark-line"></i>Saved Jobs
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search jobs by title, city, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-10 bg-[#111d35] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50"
              />
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg"></i>
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none px-4 py-3 pr-8 bg-[#111d35] border border-[#1e2d4d] rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="highest">Highest Pay</option>
                <option value="soonest">Starting Soon</option>
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
            </div>
          </div>

          {availableTypes.length > 0 && (
            <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-none flex-wrap">
              <button
                onClick={() => setTypeFilter(null)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border cursor-pointer ${
                  typeFilter === null
                    ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-500/25'
                    : 'bg-[#162036] text-slate-400 border-[#1e2d4d] hover:border-teal-500/30 hover:text-slate-300'
                }`}
              >
                All Types
                <span className="ml-1.5 text-[10px] opacity-70">{jobs.length}</span>
              </button>
              {availableTypes.map(type => {
                const count = jobs.filter(j => normalizeType(j.security_type) === type).length;
                const isActive = typeFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(isActive ? null : type)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border cursor-pointer ${
                      isActive
                        ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-500/25'
                        : 'bg-[#162036] text-slate-400 border-[#1e2d4d] hover:border-teal-500/30 hover:text-slate-300'
                    }`}
                  >
                    {type}
                    <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredJobs.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-briefcase-line text-3xl text-slate-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">No jobs found</h3>
              <p className="text-slate-500 text-sm">
                {searchQuery ? 'Try adjusting your search terms.' : 'No open positions match your criteria right now. Check back soon.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map(job => {
                const alreadyApplied = applications.has(job.id);
                const isSaved = savedIds.has(job.id);
                const isApplying = applyingId === job.id;
                return (
                  <div key={job.id} className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5 hover:border-teal-500/20 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-lg font-semibold text-white">{job.job_title}</h3>
                          {job.urgency === 'immediate' && (
                            <span className="text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Immediate</span>
                          )}
                          {job.urgency === 'urgent' && (
                            <span className="text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Urgent</span>
                          )}
                          {alreadyApplied && (
                            <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Applied</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-3">{job.clients?.company_name || 'Private Client'}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><i className="ri-map-pin-line text-slate-500"></i>{job.venue_city}</span>
                          <span className="flex items-center gap-1"><i className="ri-calendar-line text-slate-500"></i>{new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span className="flex items-center gap-1"><i className="ri-time-line text-slate-500"></i>{job.start_time?.slice(0,5)} – {job.end_time?.slice(0,5)}</span>
                          <span className="flex items-center gap-1 font-semibold text-teal-400"><i className="ri-money-pound-circle-line"></i>£{Number(job.hourly_rate).toFixed(2)}/hr</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Link href={`/guard/jobs/${job.id}`} className="px-4 py-2 bg-[#162036] text-slate-300 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap text-center">
                          View Details
                        </Link>
                        {alreadyApplied ? (
                          <>
                            <button disabled className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-xl border border-emerald-500/20 cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-1.5">
                              <i className="ri-check-line"></i>Applied
                            </button>
                            {job.clients?.user_id && guardId && (
                              <button
                                onClick={() => setMessageModalJob(job)}
                                className="px-4 py-2 bg-[#162036] text-teal-400 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <i className="ri-message-3-line"></i>Message Client
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handleQuickApply(job)}
                            disabled={isApplying}
                            className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 transition-all whitespace-nowrap flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                          >
                            {isApplying ? (
                              <>
                                <i className="ri-loader-4-line animate-spin w-4 h-4 flex items-center justify-center"></i>
                                Applying...
                              </>
                            ) : (
                              <>
                                <i className="ri-send-plane-line"></i>Quick Apply
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => toggleSave(job.id)}
                          disabled={savingId === job.id}
                          className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors whitespace-nowrap ${
                            isSaved
                              ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                              : 'bg-[#162036] text-slate-400 border-[#1e2d4d] hover:border-teal-500/20'
                          }`}
                        >
                          {isSaved ? 'Saved' : 'Save'}
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
      {messageModalJob && (
        <MessageClientModal
          isOpen={true}
          onClose={() => setMessageModalJob(null)}
          jobId={messageModalJob.id}
          clientUserId={messageModalJob.clients?.user_id || ''}
          clientName={messageModalJob.clients?.company_name || 'Client'}
          jobTitle={messageModalJob.job_title}
          guardUserId={guardId || ''}
        />
      )}
    </div>
  );
}