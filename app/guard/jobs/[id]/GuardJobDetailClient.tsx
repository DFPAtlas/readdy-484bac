'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';
import PaymentFlowIndicator from '@/components/guard/PaymentFlowIndicator';
import { getPaymentFlowStatus, FlowSourceData } from '@/lib/payments/paymentFlowStatus';
import MessageClientModal from '@/app/guard/components/MessageClientModal';

interface JobDetail {
  id: string;
  client_id: string;
  job_title: string;
  job_description: string;
  security_type: string;
  number_of_guards: number;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  urgency: string;
  sia_licence_required: boolean;
  required_licence_types: string[] | null;
  experience_level: string | null;
  venue_name: string;
  venue_address_line1: string;
  venue_city: string;
  venue_postcode: string;
  uniform_required: boolean;
  uniform_details: string | null;
  additional_requirements: string | null;
  hourly_rate: number;
  status: string;
  created_at: string;
  clients: { company_name: string } | null;
}

export default function GuardJobDetailClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [guardUserId, setGuardUserId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [guardProfile, setGuardProfile] = useState<any>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);
  const [hasInvite, setHasInvite] = useState(false);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [canMessage, setCanMessage] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [canApply, setCanApply] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [flowData, setFlowData] = useState<FlowSourceData | null>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/guard/login'); return; }
    setGuardUserId(user.id);

    const { data: guard } = await supabase
      .from('guards')
      .select('id, full_name, verification_status, licence_types, sia_licence_number, sia_verified')
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

    loadPaymentFlow(guard.id);

    const { data: jobData } = await supabase
      .from('jobs')
      .select(`
        id, client_id, job_title, job_description, security_type, number_of_guards,
        start_date, end_date, start_time, end_time, urgency, sia_licence_required,
        required_licence_types, experience_level, venue_name, venue_address_line1,
        venue_city, venue_postcode, uniform_required, uniform_details,
        additional_requirements, hourly_rate, status, created_at,
        clients ( company_name )
      `)
      .eq('id', jobId)
      .eq('is_deleted', false)
      .maybeSingle();

    setJob(jobData as any);

    if (jobData?.client_id) {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('user_id')
        .eq('id', jobData.client_id)
        .maybeSingle();
      if (clientRow?.user_id) setClientUserId(clientRow.user_id);
    }

    const { data: app } = await supabase
      .from('job_applications')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('guard_id', guard.id)
      .maybeSingle();

    if (app) {
      setHasApplied(true);
    }

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('guard_id', guard.id)
      .maybeSingle();

    if (assignment) {
      setIsAssigned(true);
    }

    const { data: invite } = await supabase
      .from('job_invites')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('guard_id', guard.id)
      .maybeSingle();

    if (invite) {
      setHasInvite(true);
    }

    const { data: saved } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('job_id', jobId)
      .eq('guard_id', guard.id)
      .maybeSingle();
    if (saved) setIsSaved(true);

    setLoading(false);
  }, [jobId, router]);

  const loadPaymentFlow = useCallback(async (gId: string) => {
    setLoadingFlow(true);
    try {
      const { data: assignment } = await supabase
        .from('job_assignments')
        .select('id, status, payment_amount, payment_status, payout_released, payout_released_at, payout_id')
        .eq('job_id', jobId)
        .eq('guard_id', gId)
        .maybeSingle();

      if (!assignment) { setFlowData(null); setLoadingFlow(false); return; }

      const { data: jobData } = await supabase
        .from('jobs')
        .select('payment_status, completion_status, disputed, agreed_amount, currency, guard_payout_amount')
        .eq('id', jobId)
        .maybeSingle();

      const { data: completion } = await supabase
        .from('job_completion_requests')
        .select('status, client_approved_at, client_disputed_at, dispute_reason')
        .eq('job_id', jobId)
        .eq('guard_id', gId)
        .maybeSingle();

      const { data: payout } = await supabase
        .from('guard_payouts')
        .select('status, amount, net_amount, stripe_transfer_status, failure_reason, completed_date, expected_date')
        .eq('assignment_id', assignment.id)
        .eq('guard_id', gId)
        .maybeSingle();

      const data: FlowSourceData = {
        assignmentStatus: assignment.status,
        assignmentPaymentStatus: assignment.payment_status,
        assignmentPaymentAmount: assignment.payment_amount,
        assignmentPayoutReleased: assignment.payout_released,
        assignmentPayoutReleasedAt: assignment.payout_released_at,
        assignmentPayoutId: assignment.payout_id,
        jobPaymentStatus: jobData?.payment_status || null,
        jobCompletionStatus: jobData?.completion_status || null,
        jobDisputed: jobData?.disputed || null,
        jobAgreedAmount: jobData?.agreed_amount || null,
        jobCurrency: jobData?.currency || null,
        jobGuardPayoutAmount: jobData?.guard_payout_amount || null,
        completionRequestStatus: completion?.status || null,
        completionRequestClientApprovedAt: completion?.client_approved_at || null,
        completionRequestClientDisputedAt: completion?.client_disputed_at || null,
        completionRequestDisputeReason: completion?.dispute_reason || null,
        payoutStatus: payout?.status || null,
        payoutAmount: payout?.amount || null,
        payoutNetAmount: payout?.net_amount || null,
        payoutStripeTransferStatus: payout?.stripe_transfer_status || null,
        payoutFailureReason: payout?.failure_reason || null,
        payoutCompletedDate: payout?.completed_date || null,
        payoutExpectedDate: payout?.expected_date || null,
      };
      setFlowData(data);
    } catch {
      setFlowData(null);
    } finally {
      setLoadingFlow(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleScroll = () => {
      const sidebarCard = document.getElementById('job-summary-card');
      if (sidebarCard) {
        const rect = sidebarCard.getBoundingClientRect();
        setStickyVisible(rect.bottom < 0);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!job || !guardProfile) { setCanApply(false); return; }

    const status = guardProfile.verification_status;
    if (status !== 'approved' && status !== 'verified') {
      setCanApply(false);
      setBlockReason('Your guard profile is pending verification.');
      return;
    }
    if (job.status !== 'open') {
      setCanApply(false);
      setBlockReason('This job is no longer open for applications.');
      return;
    }
    if (hasApplied) { setCanApply(false); return; }

    if (job.sia_licence_required && job.required_licence_types && job.required_licence_types.length > 0) {
      const guardLicences = guardProfile.licence_types || [];
      const hasRequired = job.required_licence_types.some((req: string) =>
        guardLicences.some((lic: string) => lic.toLowerCase() === req.toLowerCase())
      );
      if (!hasRequired) {
        setCanApply(false);
        setBlockReason(`This job requires licence types you do not hold: ${job.required_licence_types.join(', ')}.`);
        return;
      }
    }
    setCanApply(true);
    setBlockReason(null);
  }, [job, guardProfile, hasApplied]);

  useEffect(() => {
    setCanMessage(hasApplied || isAssigned || hasInvite);
  }, [hasApplied, isAssigned, hasInvite]);

  const handleApply = async () => {
    if (!guardId || !job) return;

    const limitCheck = await checkGuardApplicationLimit(supabase, guardId);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'limit_reached') {
        showToast('Monthly application limit reached. Upgrade your plan to apply for more jobs.', 'error');
        router.push('/upgrade?reason=guard_application_limit_reached');
      } else {
        showToast('Could not verify your subscription plan. Please contact support.', 'error');
      }
      return;
    }

    setApplying(true);
    try {
      const { error } = await supabase.from('job_applications').insert({
        job_id: jobId,
        guard_id: guardId,
        cover_letter: applyMessage || null,
        cover_message: applyMessage || null,
        status: 'pending',
        applied_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === '23505') {
          setHasApplied(true);
          showToast('Already applied to this job', 'info');
          setApplying(false);
          return;
        }
        throw error;
      }

      try {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', job.client_id)
          .maybeSingle();

        if (clientRow?.user_id) {
          await supabase.from('notifications').insert({
            user_id: clientRow.user_id,
            user_type: 'client',
            type: 'job_application',
            title: 'New Application Received',
            message: `${guardProfile?.full_name || 'A guard'} applied for "${job.job_title}".`,
            link: `/client/jobs/${jobId}/select-guards`,
            is_read: false,
          });
        }
      } catch { /* non-blocking */ }

      setShowApplyModal(false);
      setHasApplied(true);
      setCanApply(false);
      showToast('Application submitted! The client has been notified.', 'success');
    } catch (err: any) {
      showToast('Failed to apply: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setApplying(false);
    }
  };

  const toggleSave = async () => {
    if (!guardId || !job) return;
    if (isSaved) {
      const { data: row } = await supabase.from('saved_jobs').select('id').eq('job_id', jobId).eq('guard_id', guardId).maybeSingle();
      if (row) await supabase.from('saved_jobs').delete().eq('id', row.id);
      setIsSaved(false);
      showToast('Job removed from saved', 'info');
    } else {
      await supabase.from('saved_jobs').insert({ job_id: jobId, guard_id: guardId });
      setIsSaved(true);
      showToast('Job saved!', 'success');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex">
        <PortalSidebar role="guard" displayName={guardName} subtitle="Verified" initials={guardName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} accentColor="emerald" />
        <div className="flex-1 lg:ml-72 min-h-screen flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <i className="ri-file-search-line text-3xl text-red-400"></i>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Job Not Found</h2>
            <p className="text-slate-400 mb-6">This job is no longer available.</p>
            <Link href="/guard/jobs" className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-colors whitespace-nowrap">
              Browse Jobs
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

        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/guard/jobs" className="text-slate-400 hover:text-white transition-colors">
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{job.job_title}</h1>
              <p className="text-sm text-slate-500">{job.clients?.company_name || 'Private Client'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <i className="ri-file-text-line text-teal-400"></i>Job Description
                </h2>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">{job.job_description}</p>
              </div>

              {flowData && (
                <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <i className="ri-exchange-funds-line text-teal-400"></i>Payment Progress
                  </h2>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-400">Job Amount</span>
                    <span className="text-lg font-bold text-teal-400">
                      {(() => {
                        const flow = getPaymentFlowStatus(flowData);
                        const amount = flow.job_secured.amount || flow.guard_paid.amount;
                        if (!amount) return '—';
                        const sym = flow.job_secured.currency === 'GBP' ? '£' : flow.job_secured.currency === 'EUR' ? '€' : '$';
                        return `${sym}${Number(amount).toFixed(2)}`;
                      })()}
                    </span>
                  </div>
                  <PaymentFlowIndicator flow={getPaymentFlowStatus(flowData)} />
                </div>
              )}

              {loadingFlow && (
                <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
                  <div className="h-4 bg-slate-700 rounded w-1/3 mb-4 animate-pulse"></div>
                  <div className="h-12 bg-slate-700 rounded w-full animate-pulse"></div>
                </div>
              )}

              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <i className="ri-map-pin-line text-teal-400"></i>Location
                </h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <i className="ri-building-line text-teal-400 text-lg mt-0.5"></i>
                    <div>
                      <p className="font-semibold text-white">{job.venue_name}</p>
                      <p className="text-slate-400 text-sm">{job.venue_address_line1}, {job.venue_city}, {job.venue_postcode}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <i className="ri-shield-check-line text-teal-400"></i>Requirements
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm w-32">SIA Licence</span>
                    <span className={`font-medium text-sm ${job.sia_licence_required ? 'text-teal-400' : 'text-slate-500'}`}>
                      {job.sia_licence_required ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                  {job.required_licence_types && job.required_licence_types.length > 0 && (
                    <div className="flex items-start gap-3">
                      <span className="text-slate-400 text-sm w-32 flex-shrink-0">Licence Types</span>
                      <div className="flex flex-wrap gap-2">
                        {job.required_licence_types.map((t, i) => (
                          <span key={i} className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-0.5 rounded-full text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.experience_level && (
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-sm w-32">Experience</span>
                      <span className="text-slate-300 text-sm">{job.experience_level.charAt(0).toUpperCase() + job.experience_level.slice(1)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm w-32">Uniform</span>
                    <span className="text-slate-300 text-sm">{job.uniform_required ? 'Required' : 'Not Required'}</span>
                  </div>
                  {job.additional_requirements && (
                    <div className="flex items-start gap-3">
                      <span className="text-slate-400 text-sm w-32 flex-shrink-0">Additional</span>
                      <p className="text-slate-300 text-sm whitespace-pre-line">{job.additional_requirements}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div id="job-summary-card" className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-white mb-4">Job Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm border-b border-[#1e2d4d] pb-3">
                    <span className="text-slate-400">Security Type</span>
                    <span className="text-white font-medium">{job.security_type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-[#1e2d4d] pb-3">
                    <span className="text-slate-400">Guards Needed</span>
                    <span className="text-white font-medium">{job.number_of_guards}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-[#1e2d4d] pb-3">
                    <span className="text-slate-400">Date</span>
                    <span className="text-white font-medium">{new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-[#1e2d4d] pb-3">
                    <span className="text-slate-400">Shift</span>
                    <span className="text-white font-medium">{job.start_time?.slice(0,5)} – {job.end_time?.slice(0,5)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-[#1e2d4d] pb-3">
                    <span className="text-slate-400">Hourly Rate</span>
                    <span className="text-teal-400 font-bold">£{Number(job.hourly_rate).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-[#1e2d4d] pb-3">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-medium ${job.status === 'open' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Posted</span>
                    <span className="text-white font-medium">{new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>

                {hasApplied ? (
                  <div className="w-full bg-emerald-500/10 text-emerald-400 py-3 rounded-xl font-semibold mt-6 text-center border border-emerald-500/20">
                    <i className="ri-checkbox-circle-line mr-2"></i>Application Submitted
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!canApply) {
                        showToast(blockReason || 'Cannot apply for this job', 'error');
                      } else {
                        setShowApplyModal(true);
                      }
                    }}
                    className="w-full bg-teal-500 hover:bg-teal-400 text-white py-4 rounded-xl font-bold text-base transition-all mt-6 hover:shadow-lg hover:shadow-teal-500/20 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="ri-send-plane-fill text-lg"></i>Apply Now
                  </button>
                )}

                {canMessage && clientUserId && guardUserId && (
                  <button
                    onClick={() => setShowMessageModal(true)}
                    className="w-full bg-[#162036] hover:bg-[#1a2642] text-teal-400 py-3 rounded-xl font-semibold transition-colors mt-3 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer border border-[#1e2d4d] hover:border-teal-500/20"
                  >
                    <i className="ri-message-3-line text-lg"></i>Message Client
                  </button>
                )}

                <button
                  onClick={toggleSave}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors mt-3 whitespace-nowrap cursor-pointer ${
                    isSaved ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-[#162036] text-slate-300 hover:bg-[#1a2642]'
                  }`}
                >
                  <i className={isSaved ? 'ri-bookmark-fill mr-2' : 'ri-bookmark-line mr-2'}></i>
                  {isSaved ? 'Saved' : 'Save Job'}
                </button>

                {blockReason && !hasApplied && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-start gap-2">
                    <i className="ri-error-warning-line text-lg mt-0.5"></i>
                    <p>{blockReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {stickyVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B1933]/95 backdrop-blur-md border-t border-[#1e2d4d] px-4 py-3 lg:ml-72 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="min-w-0 hidden sm:block">
                <p className="text-sm font-semibold text-white truncate">{job.job_title}</p>
                <p className="text-xs text-slate-500 truncate">{job.venue_city} &middot; {job.start_time?.slice(0,5)} &ndash; {job.end_time?.slice(0,5)}</p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                <span className="text-teal-400 font-bold text-sm sm:text-lg">&pound;{Number(job.hourly_rate).toFixed(2)}<span className="text-slate-500 font-normal text-xs">/hr</span></span>
                <button
                  onClick={toggleSave}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                    isSaved ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:border-teal-500/20 hover:text-teal-400'
                  }`}
                >
                  <i className={isSaved ? 'ri-bookmark-fill text-lg' : 'ri-bookmark-line text-lg'}></i>
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {hasApplied ? (
                <div className="px-5 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl font-semibold text-sm border border-emerald-500/20 whitespace-nowrap">
                  <i className="ri-checkbox-circle-line mr-1.5"></i>Applied
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!canApply) {
                      showToast(blockReason || 'Cannot apply for this job', 'error');
                    } else {
                      setShowApplyModal(true);
                    }
                  }}
                  className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer"
                >
                  Apply Now
                </button>
              )}
              {canMessage && clientUserId && guardUserId && (
                <button
                  onClick={() => setShowMessageModal(true)}
                  className="px-5 py-2.5 bg-[#162036] hover:bg-[#1a2642] text-teal-400 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer border border-[#1e2d4d] hover:border-teal-500/20"
                >
                  <i className="ri-message-3-line mr-1.5"></i>Message
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showApplyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl max-w-md w-full p-8">
            <h3 className="text-xl font-bold text-white mb-4">Apply for this Job</h3>
            <p className="text-slate-400 mb-4">Applying for: <span className="font-semibold text-white">{job.job_title}</span></p>
            <textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Tell the client why you're the best fit..."
              className="w-full bg-[#0e1628] border border-[#1e2d4d] rounded-xl p-4 mb-2 h-32 resize-none text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              maxLength={500}
            />
            <p className="text-sm text-slate-500 mb-4">{applyMessage.length}/500</p>
            <div className="flex gap-3">
              <button onClick={handleApply} disabled={applying} className="flex-1 bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl font-semibold whitespace-nowrap disabled:opacity-50">
                {applying ? 'Submitting...' : 'Submit Application'}
              </button>
              <button onClick={() => setShowApplyModal(false)} className="flex-1 bg-[#162036] hover:bg-[#1a2642] text-slate-300 py-3 rounded-xl font-semibold whitespace-nowrap">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMessageModal && clientUserId && guardUserId && job && (
        <MessageClientModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          jobId={job.id}
          clientUserId={clientUserId}
          clientName={job.clients?.company_name || 'Client'}
          jobTitle={job.job_title}
          guardUserId={guardUserId}
        />
      )}
    </div>
  );
}