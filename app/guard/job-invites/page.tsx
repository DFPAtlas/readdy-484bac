'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { submitGuardApplication } from '@/lib/guard-applications';
import { GuardJobInvite as JobInvite, loadGuardJobInvites, guardInviteRate, guardInviteTimestamp } from '@/lib/guard-job-invites';
import MessageClientModal from '@/app/guard/components/MessageClientModal';
import { formatDateOnly } from '@/lib/date-only';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Awaiting Response', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  accepted: { label: 'Accepted', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  declined: { label: 'Declined', bg: 'bg-red-500/10', text: 'text-red-400' },
  expired: { label: 'Expired', bg: 'bg-slate-500/10', text: 'text-slate-500' },
};

export default function GuardJobInvitesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<JobInvite[]>([]);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [guardUserId, setGuardUserId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [messageModalInvite, setMessageModalInvite] = useState<JobInvite | null>(null);
  const [clientUserId, setClientUserId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const reading = useRef(false);
  const actionSequence = useRef(0);
  const actionPending = useRef(false);
  const messageSequence = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retire = useCallback(() => {
    generation.current++; readSequence.current++; actionSequence.current++; messageSequence.current++;
    actionPending.current = false; reading.current = false;
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (!mounted.current) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => { if (mounted.current) setToast(null); }, 3500);
  };

  const load = useCallback(async () => {
    if (!mounted.current || actionPending.current) return;
    const sequence = ++readSequence.current;
    generation.current++; messageSequence.current++;
    const current = () => mounted.current && readSequence.current === sequence;
    reading.current = true;
    setLoading(true); setLoadError(false); setInvites([]);
    setGuardId(null); setGuardUserId(null); setGuardName('Guard'); setMessageModalInvite(null); setClientUserId(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError) throw authError;
      if (!user) { setLoadError(true); router.push('/guard/login'); return; }
      const { data: guard, error: guardError } = await supabase.from('guards')
        .select('id, user_id, full_name, verification_status, is_active').eq('user_id', user.id).maybeSingle();
      if (!current()) return;
      if (guardError) throw guardError;
      if (!guard) { setLoadError(true); router.push('/guard/login'); return; }
      if (guard.user_id !== user.id) throw new Error('Guard identity changed');
      if (guard.is_active === false || !['approved', 'verified'].includes(guard.verification_status)) { setLoadError(true); router.push('/guard/onboarding'); return; }
      const rows = await loadGuardJobInvites(supabase, guard.id, current);
      if (!current() || !rows) return;
      const after = await supabase.auth.getUser();
      if (!current()) return;
      if (after.error || after.data.user?.id !== user.id) throw new Error('Session changed');
      setGuardId(guard.id); setGuardUserId(user.id); setGuardName(guard.full_name || 'Guard'); setInvites(rows);
    } catch { if (current()) setLoadError(true); }
    finally { if (current()) { reading.current = false; setLoading(false); } }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const focus = () => { void load(); };
    window.addEventListener('focus', focus);
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        retire(); setInvites([]); setGuardId(null); setGuardUserId(null); setProcessing(null);
        setMessageModalInvite(null); setClientUserId(null); setToast(null); setLoading(true);
        clearTimeout(authTimer);
        authTimer = setTimeout(() => { if (mounted.current) void load(); }, 0);
      }
    });
    return () => { mounted.current = false; retire(); subscription.unsubscribe(); window.removeEventListener('focus', focus); clearTimeout(authTimer); };
  }, [load, retire]);

  const openMessageModal = async (invite: JobInvite) => {
    if (!invite.jobs || invite.status !== 'accepted' || reading.current || actionPending.current) return;
    const epoch = generation.current, sequence = ++messageSequence.current;
    const current = () => mounted.current && generation.current === epoch && messageSequence.current === sequence;
    try {
      const jobResult = await supabase.from('jobs').select('client_id').eq('id', invite.jobs.id).maybeSingle();
      if (!current()) return;
      if (jobResult.error || !jobResult.data?.client_id) throw new Error('Client unavailable');
      const result = await supabase.from('clients').select('user_id').eq('id', jobResult.data.client_id).maybeSingle();
      if (!current()) return;
      if (result.error || !result.data?.user_id) throw new Error('Client unavailable');
      setClientUserId(result.data.user_id); setMessageModalInvite(invite);
    } catch { if (current()) showToast('Client messaging details could not be loaded. Please retry.', 'error'); }
  };

  const respond = async (inviteId: string, jobId: string, accept: boolean) => {
    if (!guardId || !guardUserId || reading.current || actionPending.current || !invites.some(i => i.id === inviteId && i.status === 'pending' && i.jobs?.id === jobId)) return;
    actionPending.current = true;
    const epoch = generation.current, sequence = ++actionSequence.current;
    const current = () => mounted.current && generation.current === epoch && actionSequence.current === sequence;
    setProcessing(inviteId);
    try {
      const before = await supabase.auth.getUser();
      if (!current()) return;
      if (before.error || before.data.user?.id !== guardUserId) throw new Error('Session changed');
      if (!accept) {
        const { data: declined, error } = await supabase.from('job_invites')
          .update({ status: 'declined', responded_at: new Date().toISOString() })
          .eq('id', inviteId).eq('guard_id', guardId).eq('status', 'pending').select('id, status, responded_at');
        if (!current()) return;
        if (error || declined?.length !== 1 || declined[0].id !== inviteId || declined[0].status !== 'declined') throw new Error('Response not confirmed');
        const after = await supabase.auth.getUser();
        if (!current()) return;
        if (after.error || after.data.user?.id !== guardUserId) throw new Error('Session changed');
        showToast('Invite declined.', 'info');
        setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: 'declined', responded_at: declined[0].responded_at } : inv));
        return;
      }
      // The server handles eligibility, plan limits and replay atomically. A
      // preflight limit check must not block replay after a lost acceptance reply.
      const result = await submitGuardApplication({ guardId, jobId, inviteId, coverMessage: 'Applied via job invite.' });
      if (!current()) return;
      const after = await supabase.auth.getUser();
      if (!current()) return;
      if (after.error || after.data.user?.id !== guardUserId) throw new Error('Session changed');
      if (!result.ok || !result.applicationId) {
        if (result.limitReached) {
          showToast('You have reached your monthly application limit. Upgrade your plan to apply for more jobs.', 'error');
          router.push('/upgrade?reason=guard_application_limit_reached');
        } else showToast(result.error || 'The response could not be confirmed. Refresh before retrying.', 'error');
        return;
      }
      showToast(result.replayed ? 'Invite already accepted.' : 'Invite accepted! Application submitted.', 'success');
      setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: 'accepted' } : inv));
    } catch { if (current()) showToast('The response could not be confirmed. Refresh before retrying.', 'error'); }
    finally {
      if (actionSequence.current === sequence) {
        actionPending.current = false;
        if (mounted.current) { setProcessing(null); void load(); }
      }
    }
  };

  const pendingCount = invites.filter(i => i.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div role="status" aria-label="Loading invitations" className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      <PortalSidebar
        role="guard"
        displayName={guardName}
        subtitle={guardId ? 'Verified' : 'Invitations'}
        initials={guardName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        accentColor="emerald"
      />

      <div className="flex-1 min-h-screen pt-16 lg:pt-8 pb-24 px-4 sm:px-8">
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
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                Job Invites
                {!loadError && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} new</span>
                )}
              </h1>
              <p className="text-sm text-slate-500">{loadError ? 'Invitations unavailable' : `${invites.length} invite${invites.length !== 1 ? 's' : ''} total`}</p>
            </div>
          </div>

          <button type="button" onClick={() => void load()} disabled={processing !== null} className="mb-5 text-teal-400 underline disabled:opacity-50">Refresh invitations</button>
          {loadError && <div role="alert" className="mb-6 rounded-xl border border-red-500/30 p-4 text-red-300">Invitations could not be loaded. Please retry or sign in again.<button type="button" onClick={() => void load()} className="ml-3 underline">Retry</button></div>}

          {!loadError && pendingCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <i className="ri-mail-unread-line text-xl text-amber-400"></i>
              <p className="text-sm text-amber-300 font-medium">
                You have {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''} from clients. Review the available details below.
              </p>
            </div>
          )}

          {loadError ? null : invites.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-mail-line text-3xl text-slate-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">No invites yet</h3>
              <p className="text-slate-500 text-sm mb-6">
                Clients can invite you directly to their jobs. Complete your profile to increase visibility.
              </p>
              <Link href="/guard/profile" className="inline-flex items-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap">
                <i className="ri-user-line"></i>View Profile
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map(invite => {
                const job = invite.jobs;
                const cfg = Object.prototype.hasOwnProperty.call(statusConfig, invite.status || '') ? statusConfig[invite.status!] : { label: 'Status unavailable', bg: 'bg-slate-500/10', text: 'text-slate-400' };
                const isPending = invite.status === 'pending';
                const isAccepted = invite.status === 'accepted';
                return (
                  <div key={invite.id} className={`bg-[#111d35] rounded-2xl border transition-all p-5 ${isPending ? 'border-amber-500/30' : 'border-[#1e2d4d]'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-lg font-semibold text-white">{job?.job_title || 'Job details unavailable'}</h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} border-current/20`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">{job?.clients?.company_name || 'Client details unavailable'}</p>
                        {invite.message && (
                          <div className="bg-[#162036] rounded-xl p-3 mb-3 border border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1 font-medium">Message from client:</p>
                            <p className="text-sm text-slate-300 italic">{invite.message}</p>
                          </div>
                        )}
                        {job ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><i className="ri-map-pin-line text-slate-500"></i>{job.venue_city}</span>
                          <span className="flex items-center gap-1"><i className="ri-calendar-line text-slate-500"></i>{formatDateOnly(job.start_date, { day: 'numeric', month: 'short' })}</span>
                          <span className="flex items-center gap-1"><i className="ri-time-line text-slate-500"></i>{job.start_time && job.end_time ? `${job.start_time} – ${job.end_time}` : 'Time not recorded'}</span>
                          <span className="flex items-center gap-1 font-semibold text-teal-400"><i className="ri-money-pound-circle-line"></i>{guardInviteRate(job.hourly_rate)}</span>
                        </div> : <p className="text-sm text-slate-400">This invitation is retained. Linked job details are unavailable; responding and job navigation are disabled.</p>}
                        <p className="text-xs text-slate-600 mt-3">
                          Invited {guardInviteTimestamp(invite.invited_at)}
                          {invite.responded_at && ` · Responded ${guardInviteTimestamp(invite.responded_at, { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {job && <Link href={`/jobs/detail?id=${encodeURIComponent(job.id)}`} className="px-4 py-2 bg-[#162036] text-slate-300 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap text-center">
                          View Job
                        </Link>}
                        {job && isAccepted && (
                          <button
                            onClick={() => openMessageModal(invite)}
                            className="px-4 py-2 bg-[#162036] text-teal-400 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <i className="ri-message-3-line"></i>Message Client
                          </button>
                        )}
                        {job && isPending && (
                          <>
                            <button
                              onClick={() => respond(invite.id, job.id, true)}
                              disabled={processing !== null}
                              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              {processing === invite.id ? 'Processing...' : 'Accept & Apply'}
                            </button>
                            <button
                              onClick={() => respond(invite.id, job.id, false)}
                              disabled={processing !== null}
                              className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {messageModalInvite && guardUserId && clientUserId && (
        <MessageClientModal
          isOpen={true}
          onClose={() => { setMessageModalInvite(null); setClientUserId(null); }}
          jobId={messageModalInvite.jobs!.id}
          clientUserId={clientUserId}
          clientName={messageModalInvite.jobs!.clients?.company_name || 'Client'}
          jobTitle={messageModalInvite.jobs!.job_title || 'Job details unavailable'}
          guardUserId={guardUserId}
        />
      )}
    </div>
  );
}
