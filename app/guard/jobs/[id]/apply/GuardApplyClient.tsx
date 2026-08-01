'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';

interface JobBasic {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  start_date: string;
  hourly_rate: number;
  status: string;
  sia_licence_required: boolean;
  required_licence_types: string[] | null;
  clients: { company_name: string } | null;
}

export default function GuardApplyClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobBasic | null>(null);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [guardProfile, setGuardProfile] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
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
    if (guard.verification_status !== 'approved' && guard.verification_status !== 'verified') {
      router.push('/guard/onboarding');
      return;
    }

    setGuardId(guard.id);
    setGuardName(guard.full_name);
    setGuardProfile(guard);

    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_title, venue_name, venue_city, start_date, hourly_rate, status, sia_licence_required, required_licence_types, clients ( company_name )')
      .eq('id', jobId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!jobData || jobData.status !== 'open') {
      setJob(null);
      setLoading(false);
      return;
    }

    setJob(jobData as any);

    const { data: app } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('guard_id', guard.id)
      .maybeSingle();

    if (app) setAlreadyApplied(true);

    setLoading(false);
  }, [jobId, router]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!guardId || !job || !guardProfile) return;

    if (job.sia_licence_required && job.required_licence_types && job.required_licence_types.length > 0) {
      const guardLicences = guardProfile.licence_types || [];
      const hasRequired = job.required_licence_types.some((req: string) =>
        guardLicences.some((lic: string) => lic.toLowerCase() === req.toLowerCase())
      );
      if (!hasRequired) {
        showToast(`This job requires licence types you do not hold: ${job.required_licence_types.join(', ')}.`, 'error');
        return;
      }
    }

    const limitCheck = await checkGuardApplicationLimit(supabase, guardId);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'limit_reached') {
        showToast('Monthly application limit reached. Upgrade your plan to apply for more jobs.', 'error');
        router.push('/upgrade?reason=guard_application_limit_reached');
      } else {
        showToast('Could not verify your subscription plan.', 'error');
      }
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('job_applications').insert({
        job_id: jobId,
        guard_id: guardId,
        cover_letter: message || null,
        cover_message: message || null,
        status: 'pending',
        applied_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === '23505') {
          showToast('Already applied to this job', 'info');
          setSubmitting(false);
          return;
        }
        throw error;
      }

      try {
        const { data: clientRow } = await supabase
          .from('jobs')
          .select('client_id')
          .eq('id', jobId)
          .maybeSingle();

        if (clientRow?.client_id) {
          const { data: cl } = await supabase
            .from('clients')
            .select('user_id')
            .eq('id', clientRow.client_id)
            .maybeSingle();

          if (cl?.user_id) {
            await supabase.from('notifications').insert({
              user_id: cl.user_id,
              user_type: 'client',
              type: 'job_application',
              title: 'New Application Received',
              message: `${guardProfile?.full_name || 'A guard'} applied for "${job.job_title}".`,
              link: `/client/jobs/${jobId}/select-guards`,
              is_read: false,
            });
          }
        }
      } catch { /* non-blocking */ }

      showToast('Application submitted successfully!', 'success');
      setTimeout(() => router.push(`/guard/jobs/${jobId}`), 1500);
    } catch (err: any) {
      showToast('Failed to apply: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!job || alreadyApplied) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex">
        <PortalSidebar role="guard" displayName={guardName} subtitle="Verified" initials={guardName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} accentColor="emerald" />
        <div className="flex-1 lg:ml-72 min-h-screen flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <i className="ri-error-warning-line text-3xl text-amber-400"></i>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{alreadyApplied ? 'Already Applied' : 'Job Unavailable'}</h2>
            <p className="text-slate-400 mb-6">{alreadyApplied ? 'You have already applied to this job.' : 'This job is no longer available for applications.'}</p>
            <Link href="/guard/jobs" className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-colors whitespace-nowrap">
              Back to Jobs
            </Link>
          </div>
        </div>
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

        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href={`/guard/jobs/${jobId}`} className="text-slate-400 hover:text-white transition-colors">
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>
            <h1 className="text-2xl font-bold text-white">Apply for Job</h1>
          </div>

          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">{job.job_title}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1"><i className="ri-building-line"></i>{job.clients?.company_name || 'Private Client'}</span>
              <span className="flex items-center gap-1"><i className="ri-map-pin-line"></i>{job.venue_city}</span>
              <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>{new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              <span className="flex items-center gap-1 font-semibold text-teal-400"><i className="ri-money-pound-circle-line"></i>£{Number(job.hourly_rate).toFixed(2)}/hr</span>
            </div>
          </div>

          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">Cover Message (optional)</label>
            <p className="text-xs text-slate-500 mb-3">Tell the client why you&apos;re the best fit for this role. Include relevant experience and qualifications.</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi, I'm interested in this position because..."
              className="w-full bg-[#0e1628] border border-[#1e2d4d] rounded-xl p-4 h-40 resize-none text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              maxLength={500}
            />
            <p className="text-xs text-slate-500 mt-2">{message.length}/500 characters</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-400 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
            <Link href={`/guard/jobs/${jobId}`} className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-xl font-semibold hover:bg-[#1a2642] transition-colors whitespace-nowrap text-center">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}