'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';
import MessageClientModal from '@/app/guard/components/MessageClientModal';

interface JobInvite {
  id: string;
  status: string;
  invited_at: string;
  responded_at: string | null;
  message: string | null;
  jobs: {
    id: string;
    job_title: string;
    security_type: string;
    venue_name: string;
    venue_city: string;
    start_date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    number_of_guards: number;
    sia_licence_required: boolean;
    clients: { company_name: string } | null;
  } | null;
}

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

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/guard/login'); return; }
    setGuardUserId(user.id);

    const { data: guard } = await supabase
      .from('guards')
      .select('id, full_name, verification_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) { router.push('/guard/login'); return; }
    if (guard.verification_status !== 'approved' && guard.verification_status !== 'verified') { router.push('/guard/onboarding'); return; }

    setGuardId(guard.id);
    setGuardName(guard.full_name);

    const { data } = await supabase
      .from('job_invites')
      .select(`
        id, status, invited_at, responded_at, message,
        jobs (
          id, job_title, security_type, venue_name, venue_city,
          start_date, start_time, end_time, hourly_rate, number_of_guards,
          sia_licence_required,
          clients ( company_name )
        )
      `)
      .eq('guard_id', guard.id)
      .order('invited_at', { ascending: false });

    setInvites((data || []) as any);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const openMessageModal = async (invite: JobInvite) => {
    if (!invite.jobs) return;
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('client_id')
      .eq('id', invite.jobs.id)
      .maybeSingle();
    if (!jobRow?.client_id) {
      showToast('Could not find client for this job.', 'error');
      return;
    }
    const { data: clientRow } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', jobRow.client_id)
      .maybeSingle();
    if (clientRow?.user_id) {
      setClientUserId(clientRow.user_id);
      setMessageModalInvite(invite);
    } else {
      showToast('Could not find client for this job.', 'error');
    }
  };

  const respond = async (inviteId: string, jobId: string, accept: boolean) => {
    if (!guardId) return;
    setProcessing(inviteId);

    const newStatus = accept ? 'accepted' : 'declined';
    const { error } = await supabase
      .from('job_invites')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('guard_id', guardId);

    if (error) {
      showToast('Failed to respond. Please try again.', 'error');
    } else {
      if (accept) {
        const limitCheck = await checkGuardApplicationLimit(supabase, guardId);
        if (!limitCheck.allowed) {
          if (limitCheck.reason === 'limit_reached') {
            showToast('You have reached your monthly application limit for your current plan. Upgrade your plan to apply for more jobs this month.', 'error');
            router.push('/upgrade?reason=guard_application_limit_reached');
          } else {
            showToast('We could not verify your guard subscription plan. Please refresh or contact support.', 'error');
            router.push('/upgrade?reason=guard.plan_verification_failed');
          }
          setProcessing(null);
          return;
        }

        const { error: appErr } = await supabase
          .from('job_applications')
          .insert({
            job_id: jobId,
            guard_id: guardId,
            status: 'pending',
            cover_message: 'Applied via job invite.',
            applied_at: new Date().toISOString(),
          });

        if (appErr && appErr.code !== '23505') {
          showToast('Invite accepted but application failed — please apply manually.', 'error');
        } else {
          showToast('Invite accepted! Application submitted.', 'success');
          try {
            const { data: jobRow } = await supabase
              .from('jobs')
              .select('job_title, client_id')
              .eq('id', jobId)
              .maybeSingle();
            if (jobRow?.client_id) {
              const { data: clientRow } = await supabase
                .from('clients')
                .select('user_id')
                .eq('id', jobRow.client_id)
                .maybeSingle();
              if (clientRow?.user_id) {
                await supabase.from('notifications').insert({
                  user_id: clientRow.user_id,
                  user_type: 'client',
                  type: 'job_application',
                  title: 'Invited Guard Applied',
                  message: `${guardName} accepted your invite and applied for "${jobRow.job_title}".`,
                  link: `/client/jobs/${jobId}/select-guards`,
                  is_read: false,
                });
              }
            }
          } catch {
            // non-blocking
          }
        }
      } else {
        showToast('Invite declined.', 'info');
      }
      setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: newStatus } : inv));
    }
    setProcessing(null);
  };

  const pendingCount = invites.filter(i => i.status === 'pending').length;

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
                {pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} new</span>
                )}
              </h1>
              <p className="text-sm text-slate-500">{invites.length} invite{invites.length !== 1 ? 's' : ''} total</p>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <i className="ri-mail-unread-line text-xl text-amber-400"></i>
              <p className="text-sm text-amber-300 font-medium">
                You have {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''} from clients. Review and respond below.
              </p>
            </div>
          )}

          {invites.length === 0 ? (
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
                if (!job) return null;
                const cfg = statusConfig[invite.status] || statusConfig.pending;
                const isPending = invite.status === 'pending';
                const isAccepted = invite.status === 'accepted';
                return (
                  <div key={invite.id} className={`bg-[#111d35] rounded-2xl border transition-all p-5 ${isPending ? 'border-amber-500/30' : 'border-[#1e2d4d]'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-lg font-semibold text-white">{job.job_title}</h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} border-current/20`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">{job.clients?.company_name || 'Private Client'}</p>
                        {invite.message && (
                          <div className="bg-[#162036] rounded-xl p-3 mb-3 border border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1 font-medium">Message from client:</p>
                            <p className="text-sm text-slate-300 italic">{invite.message}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><i className="ri-map-pin-line text-slate-500"></i>{job.venue_city}</span>
                          <span className="flex items-center gap-1"><i className="ri-calendar-line text-slate-500"></i>{new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span className="flex items-center gap-1"><i className="ri-time-line text-slate-500"></i>{job.start_time} – {job.end_time}</span>
                          <span className="flex items-center gap-1 font-semibold text-teal-400"><i className="ri-money-pound-circle-line"></i>£{Number(job.hourly_rate).toFixed(2)}/hr</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-3">
                          Invited {new Date(invite.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {invite.responded_at && ` · Responded ${new Date(invite.responded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Link href={`/jobs/${job.id}`} className="px-4 py-2 bg-[#162036] text-slate-300 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap text-center">
                          View Job
                        </Link>
                        {isAccepted && (
                          <button
                            onClick={() => openMessageModal(invite)}
                            className="px-4 py-2 bg-[#162036] text-teal-400 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <i className="ri-message-3-line"></i>Message Client
                          </button>
                        )}
                        {isPending && (
                          <>
                            <button
                              onClick={() => respond(invite.id, job.id, true)}
                              disabled={processing === invite.id}
                              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              {processing === invite.id ? 'Processing...' : 'Accept & Apply'}
                            </button>
                            <button
                              onClick={() => respond(invite.id, job.id, false)}
                              disabled={processing === invite.id}
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
          jobTitle={messageModalInvite.jobs!.job_title}
          guardUserId={guardUserId}
        />
      )}
    </div>
  );
}