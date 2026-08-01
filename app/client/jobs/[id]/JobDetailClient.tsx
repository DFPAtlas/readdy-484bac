"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import JobInfoSection from './JobInfoSection';
import AssignedGuardsSection from './AssignedGuardsSection';
import JobTimeline from './JobTimeline';
import ComplaintModal from './ComplaintModal';
import RateGuardModal from '@/components/reviews/RateGuardModal';
import LiveIndicator from '@/components/LiveIndicator';
import { useClientGuard } from '@/hooks/useClientGuard';
import { sendPushToUser } from '@/lib/push-notifications';
import MessageGuardModal from './select-guards/MessageGuardModal';
import { computeComplianceInfo, GuardComplianceData } from './compliance/useCompliance';
import JobCompliancePanel from './compliance/JobCompliancePanel';
import ComplianceWarnings from './compliance/ComplianceWarnings';
import AttendancePanel from './AttendancePanel';
import CancellationRefundPanel from './CancellationRefundPanel';
import RefundRequestModal from '../RefundRequestModal';
import CancelJobModal from '../CancelJobModal';
import BookingStatusBadge from '../BookingStatusBadge';
import { canSendJobMessage } from '@/lib/message-permissions';

interface GuardReview {
  id: string;
  guard_id: string;
  rating: number;
  review_text?: string;
  review_status: string;
  issue_reported: boolean;
}

export default function JobDetailClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [assignedGuards, setAssignedGuards] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Basic');
  const [initials, setInitials] = useState('CL');
  const [activeTab, setActiveTab] = useState<'info' | 'guards' | 'timeline' | 'complaints' | 'attendance' | 'cancellation' | 'confirmation'>('info');
  const [currentUserId, setCurrentUserId] = useState('');
  const [clientId, setClientId] = useState('');
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  const [guardReviews, setGuardReviews] = useState<Record<string, GuardReview>>({});
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewGuard, setReviewGuard] = useState<{ guardId: string; guardName: string } | null>(null);

  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [completeError, setCompleteError] = useState('');

  const [messageGuard, setMessageGuard] = useState<any>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [cancellation, setCancellation] = useState<any>(null);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [transaction, setTransaction] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  function getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  useEffect(() => {
    loadJobDetail();

    const channels: any[] = [];

    const jobChannel = supabase
      .channel(`job-detail-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'app',
        table: 'jobs',
        filter: `id=eq.${jobId}`,
      }, () => {
        loadJobDetail();
      })
      .subscribe();
    channels.push(jobChannel);

    const assignmentsChannel = supabase
      .channel(`job-detail-assignments-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'app',
        table: 'job_assignments',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        loadJobDetail();
      })
      .subscribe();
    channels.push(assignmentsChannel);

    const reviewsChannel = supabase
      .channel(`job-detail-reviews-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'app',
        table: 'reviews',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        loadJobDetail();
      })
      .subscribe();
    channels.push(reviewsChannel);

    const cancellationsChannel = supabase
      .channel(`job-detail-cancellations-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'app',
        table: 'support_tickets',
        // NOTE: no job_id filter available in realtime for support_tickets — RLS enforces client ownership at query time
        // NOTE: no job_id filter available in realtime for cancellations
        // RLS enforces client ownership at query time
      }, () => {
        loadJobDetail();
      })
      .subscribe();
    channels.push(cancellationsChannel);

    const refundsChannel = supabase
      .channel(`job-detail-refunds-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'app',
        table: 'transactions',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        loadJobDetail();
      })
      .subscribe();
    channels.push(refundsChannel);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [jobId]);

  const fetchGuardReviews = async (userId: string) => {
    const { data } = await supabase
      .from('reviews')
      .select('id, guard_id, rating, review_text, review_status, issue_reported')
      .eq('job_id', jobId)
      .eq('client_id', userId);

    const map: Record<string, GuardReview> = {};
    (data || []).forEach((r) => {
      if (r.guard_id) map[r.guard_id] = r;
    });
    setGuardReviews(map);
  };

  const loadJobDetail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/client/login'); return; }

      setCurrentUserId(user.id);

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }

      setClientId(client.id);
      setCompanyName(client.company_name || 'Client');
      setSubscriptionTier(client.subscription_tier || 'Basic');
      setInitials(getInitials(client.company_name || 'Client'));

      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('client_id', client.id)
        .maybeSingle();

      if (!jobData) { router.push('/client/jobs'); return; }
      setJob(jobData);

      const [assignmentsData, cancellationData, refundData, transactionData, activityData] = await Promise.all([
        supabase
          .from('job_assignments')
          .select('*, guards(id, user_id, full_name, profile_photo_url, sia_licence_number, phone, sia_verified, sia_expiry_date, licence_types, sia_licence_front_url, sia_licence_back_url, profile_completed, verification_status, certifications, sia_verified_at, average_rating, total_reviews, total_jobs_completed)')
          .eq('job_id', jobId),
        supabase
          .schema('app')
          .from('job_cancellations')
          .select('*')
          .eq('job_id', jobId)
          .maybeSingle(),
        supabase
          .schema('app')
          .from('refund_requests')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('client_activity_log')
          .select('*')
          .eq('client_id', client.id)
          .eq('related_job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setAssignedGuards(assignmentsData.data || []);
      setCancellation(cancellationData.data || null);
      setRefundRequests(refundData.data || []);
      setTransaction(transactionData.data || null);

      const timelineEvents = buildTimeline(jobData, assignmentsData.data || [], activityData.data || []);
      setTimeline(timelineEvents);

      await fetchGuardReviews(user.id);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    setMarkingComplete(true);
    setCompleteError('');
    try {
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (jobError) throw jobError;

      const guardId = assignedGuards[0]?.guards?.id;
      const guardUserId = assignedGuards[0]?.guards?.user_id;

      if (guardId) {
        const { data: guardData } = await supabase
          .from('guards')
          .select('total_jobs_completed')
          .eq('id', guardId)
          .maybeSingle();

        const current = guardData?.total_jobs_completed ?? 0;
        await supabase
          .from('guards')
          .update({ total_jobs_completed: current + 1 })
          .eq('id', guardId);
      }

      if (guardUserId) {
        await supabase.from('notifications').insert({
          user_id: guardUserId,
          user_type: 'guard',
          type: 'job_completed',
          title: 'Job Marked as Complete',
          message: `"${job.job_title}" has been marked as complete by the client. You may now receive a review.`,
          link: `/guard/dashboard`,
          is_read: false,
        });

        try {
          await sendPushToUser(guardUserId, 'guard', {
            title: 'Job Marked as Complete',
            body: `"${job.job_title}" has been marked as complete by the client. You may now receive a review.`,
            url: `/guard/dashboard`,
            tag: 'quickguard-complete',
          });
        } catch (e) {
          console.error('Failed to send complete push:', e);
        }
      }

      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-job-completed-guard-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ job_id: jobId }),
      }).catch(() => {});

      setJob((prev: any) => ({ ...prev, status: 'completed' }));
      setShowCompleteConfirm(false);
    } catch {
      setCompleteError('Something went wrong. Please try again.');
    } finally {
      setMarkingComplete(false);
    }
  };

  const buildTimeline = (jobData: any, assignments: any[], activityLog: any[]) => {
    const events: { date: string; label: string; icon: string; color: string; source?: string }[] = [];

    // Job creation
    if (jobData.created_at) {
      events.push({ date: jobData.created_at, label: 'Job created', icon: 'ri-file-add-line', color: 'bg-blue-500' });
    }

    // Job edited
    if (jobData.updated_at && jobData.created_at && new Date(jobData.updated_at).getTime() > new Date(jobData.created_at).getTime() + 60000) {
      events.push({ date: jobData.updated_at, label: 'Job details updated', icon: 'ri-edit-line', color: 'bg-sky-500' });
    }

    // Applicants received
    if (jobData.applications_count > 0) {
      const firstAppDate = activityLog.find(a => a.action_type === 'applicant_received')?.created_at || jobData.updated_at || jobData.created_at;
      events.push({ date: firstAppDate, label: `${jobData.applications_count} applicant${jobData.applications_count !== 1 ? 's' : ''} received`, icon: 'ri-user-received-line', color: 'bg-violet-500' });
    }

    // Guard assignments
    if (assignments.length > 0) {
      const firstAssignment = assignments[0];
      events.push({ date: firstAssignment.created_at || jobData.created_at, label: `${assignments.length} guard${assignments.length !== 1 ? 's' : ''} selected`, icon: 'ri-user-follow-line', color: 'bg-violet-500' });
    }

    // Guard confirmation events
    assignments.forEach(a => {
      if (a.guard_confirmed_at) {
        events.push({ date: a.guard_confirmed_at, label: `${a.guards?.full_name || 'Guard'} confirmed`, icon: 'ri-check-line', color: 'bg-emerald-500' });
      }
    });

    // Payment events
    if (jobData.status === 'awaiting_payment' || jobData.status === 'awaiting_client_confirmation' || jobData.status === 'confirmed' || jobData.status === 'in_progress' || jobData.status === 'completed') {
      const paymentDate = activityLog.find(a => a.action_type === 'payment_made')?.created_at || jobData.updated_at || jobData.created_at;
      events.push({ date: paymentDate, label: 'Payment completed', icon: 'ri-secure-payment-line', color: 'bg-amber-500' });
    }

    if (jobData.status === 'awaiting_client_confirmation') {
      events.push({ date: jobData.updated_at || jobData.created_at, label: 'Awaiting client confirmation', icon: 'ri-file-shield-line', color: 'bg-violet-500' });
    }

    // Booking confirmed
    if (jobData.status === 'confirmed' || jobData.status === 'in_progress' || jobData.status === 'completed') {
      events.push({ date: jobData.client_confirmed_at || jobData.updated_at || jobData.created_at, label: 'Booking confirmed', icon: 'ri-checkbox-circle-line', color: 'bg-emerald-500' });
    }

    // Terms accepted
    if (jobData.terms_accepted) {
      events.push({ date: jobData.terms_accepted_at || jobData.updated_at || jobData.created_at, label: 'Terms and conditions accepted', icon: 'ri-file-list-3-line', color: 'bg-sky-500' });
    }

    // Check-in events
    assignments.forEach(a => {
      if (a.check_in_time) {
        events.push({ date: a.check_in_time, label: `${a.guards?.full_name || 'Guard'} checked in`, icon: 'ri-login-box-line', color: 'bg-emerald-500' });
      }
    });

    // Check-out events
    assignments.forEach(a => {
      if (a.check_out_time) {
        events.push({ date: a.check_out_time, label: `${a.guards?.full_name || 'Guard'} checked out`, icon: 'ri-logout-box-line', color: 'bg-violet-500' });
      }
    });

    // Job active
    if (jobData.status === 'in_progress' || jobData.status === 'completed') {
      events.push({ date: jobData.started_at || jobData.updated_at || jobData.created_at, label: 'Job started', icon: 'ri-pulse-line', color: 'bg-teal-500' });
    }

    // Review submitted
    const reviewEntries = activityLog.filter(a => a.action_type === 'review_submitted');
    reviewEntries.forEach(r => {
      events.push({ date: r.created_at, label: `Review submitted`, icon: 'ri-star-line', color: 'bg-yellow-500' });
    });

    // Job completed
    if (jobData.status === 'completed') {
      events.push({ date: jobData.updated_at || jobData.created_at, label: 'Job completed', icon: 'ri-trophy-line', color: 'bg-emerald-600' });
    }

    // Cancellation events
    if (jobData.status === 'cancelled') {
      const cancelEntry = activityLog.find(a => a.action_type === 'job_cancelled' || a.action_type === 'cancellation_requested');
      events.push({ date: cancelEntry?.created_at || jobData.updated_at || jobData.created_at, label: 'Job cancelled', icon: 'ri-close-circle-line', color: 'bg-red-500' });
    }

    // Refund events
    const refundEntries = activityLog.filter(a => a.action_type === 'refund_requested');
    refundEntries.forEach(r => {
      events.push({ date: r.created_at, label: 'Refund requested', icon: 'ri-refund-line', color: 'bg-rose-500' });
    });

    // Replacement events
    const replacementEntries = activityLog.filter(a => a.action_type === 'replacement_requested');
    replacementEntries.forEach(r => {
      events.push({ date: r.created_at, label: 'Replacement guard requested', icon: 'ri-refresh-line', color: 'bg-violet-500' });
    });

    // Complaint events
    const complaintEntries = activityLog.filter(a => a.action_type === 'complaint_raised');
    complaintEntries.forEach(r => {
      events.push({ date: r.created_at, label: 'Complaint raised', icon: 'ri-error-warning-line', color: 'bg-orange-500' });
    });

    // Issue events
    assignments.forEach(a => {
      if (a.issue_reported && a.updated_at) {
        events.push({ date: a.updated_at, label: `Issue reported: ${a.guards?.full_name || 'Guard'}`, icon: 'ri-error-warning-line', color: 'bg-red-500' });
      }
    });

    // Disputed
    if (jobData.status === 'disputed') {
      events.push({ date: jobData.disputed_at || jobData.updated_at || jobData.created_at, label: 'Job disputed', icon: 'ri-shield-flash-line', color: 'bg-orange-500' });
    }

    // Deduplicate by date+label and sort
    const seen = new Set<string>();
    const deduped = events.filter(e => {
      const key = `${e.date}_${e.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const handleComplaintSuccess = () => {
    setShowComplaintModal(false);
    setComplaintSuccess(true);
    setTimeout(() => setComplaintSuccess(false), 4000);
  };

  const handleOpenReviewModal = (guardId: string, guardName: string) => {
    setReviewGuard({ guardId, guardName });
    setReviewModalOpen(true);
  };

  const handleReviewSuccess = async () => {
    await fetchGuardReviews(currentUserId);
  };

  const handleMessageGuard = (guardId: string, guardName: string, guardUserId: string) => {
    setMessageGuard({ guardId, guardName, guardUserId });
  };

  const handleSendMessage = async (message: string, guardUserId: string, jobIdParam?: string) => {
    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetJobId = jobIdParam || jobId;
      const perm = await canSendJobMessage({
        currentUserId: user.id,
        currentUserType: 'client',
        jobId: targetJobId,
        otherUserId: guardUserId,
        otherUserType: 'guard',
      });
      if (!perm.allowed) {
        console.error('Permission denied:', perm.error);
        setSendingMessage(false);
        return;
      }

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        sender_type: 'client',
        receiver_id: guardUserId,
        receiver_type: 'guard',
        message_text: message,
        job_id: targetJobId,
        read: false,
      });

      if (error) throw error;
      try {
        await supabase.from('notifications').insert({
          user_id: guardUserId,
          user_type: 'guard',
          type: 'message',
          title: 'New message',
          message: `New message from client${job?.job_title ? ` for "${job.job_title}"` : ''}`,
          link: '/guard/messages',
          is_read: false,
        });
      } catch (notifyErr) {
        console.error('Failed to create notification:', notifyErr);
      }
      setMessageGuard(null);
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSendingMessage(false);
    }
  };

  const isClientOwner = job?.client_id === clientId;
  const hasAssignedGuard = assignedGuards.length > 0;
  const showMarkComplete = job?.status === 'open' && isClientOwner && hasAssignedGuard;
  const needsConfirmation = job?.status === 'awaiting_client_confirmation';
  const isConfirmed = job?.status === 'confirmed' || job?.status === 'in_progress' || job?.status === 'completed';
  const isDisputed = job?.status === 'disputed';

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading job details…</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const tabs = [
    { key: 'info', label: 'Job Info', icon: 'ri-file-info-line' },
    { key: 'guards', label: `Assigned Guards (${assignedGuards.length})`, icon: 'ri-shield-user-line' },
    { key: 'attendance', label: 'Attendance', icon: 'ri-pulse-line' },
    { key: 'timeline', label: 'Timeline', icon: 'ri-time-line' },
    { key: 'confirmation', label: 'Confirmation', icon: 'ri-file-shield-line' },
    { key: 'cancellation', label: 'Cancellation', icon: 'ri-close-circle-line' },
    { key: 'complaints', label: 'Raise Issue', icon: 'ri-error-warning-line' },
  ];

  const isCompleted = job.status === 'completed';
  const unreviewedGuards = assignedGuards.filter((a) => a.guards?.id && !guardReviews[a.guards.id]);
  const reviewedGuards = assignedGuards.filter((a) => a.guards?.id && guardReviews[a.guards.id]);

  const requiredLicenceTypes = job?.required_licence_types || (job?.required_license_type ? [job.required_license_type] : null);

  const selectedGuardsCompliance = assignedGuards.map((a) => {
    const g = a.guards;
    const guardData: GuardComplianceData = {
      id: g?.id || '',
      full_name: g?.full_name || '',
      sia_verified: g?.sia_verified || false,
      sia_expiry_date: g?.sia_expiry_date || null,
      sia_licence_number: g?.sia_licence_number || null,
      licence_types: g?.licence_types || null,
      sia_licence_front_url: g?.sia_licence_front_url || null,
      sia_licence_back_url: g?.sia_licence_back_url || null,
      profile_completed: g?.profile_completed || null,
      verification_status: g?.verification_status || null,
      certifications: g?.certifications || null,
      sia_verified_at: g?.sia_verified_at || null,
    };
    return computeComplianceInfo(guardData, requiredLicenceTypes);
  });

  const compliantCount = selectedGuardsCompliance.filter((c) => c.isFullyCompliant).length;
  const needsReviewCount = selectedGuardsCompliance.filter((c) => c.needsAttention).length;

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName || 'Client'}
        subtitle={subscriptionTier || 'Free'}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/client/jobs" className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] transition-colors cursor-pointer">
              <i className="ri-arrow-left-line text-slate-400 text-base"></i>
            </Link>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">My Jobs</p>
              <h1 className="text-xl font-bold text-white truncate max-w-md">{job.job_title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <LiveIndicator />
            <BookingStatusBadge status={job.status} />
            {job.booking_reference && (
              <span className="bg-[#162036] border border-[#1e2d4d] text-slate-300 px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap">
                {job.booking_reference}
              </span>
            )}
            {hasAssignedGuard && (
              <button
                onClick={() => router.push('/client/messages')}
                className="flex items-center gap-2 px-4 py-2 bg-[#162036] border border-[#1e2d4d] text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-message-3-line"></i>
                Message Guards
              </button>
            )}
            {needsConfirmation && (
              <Link href={`/client/jobs/${job.id}/confirmation`}>
                <button className="bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-file-shield-line mr-1"></i>
                  Confirm Booking
                </button>
              </Link>
            )}
            {job.status === 'awaiting_guard_selection' && (
              <Link href={`/client/jobs/${job.id}/select-guards`}>
                <button className="bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                  Select Guards
                </button>
              </Link>
            )}
            {job.status === 'awaiting_payment' && (
              <Link href={`/client/jobs/${job.id}/payment`}>
                <button className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap">
                  Pay Now
                </button>
              </Link>
            )}
            {/* Cancel button for eligible jobs */}
            {job.status !== 'completed' && job.status !== 'cancelled' && job.status !== 'disputed' && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/25 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-circle-line"></i>
                Cancel Job
              </button>
            )}
            {showMarkComplete && (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-checkbox-circle-line"></i>
                Mark as Complete
              </button>
            )}
            {isCompleted && unreviewedGuards.length > 0 && (
              <button
                onClick={() => {
                  const firstUnreviewed = unreviewedGuards[0];
                  if (firstUnreviewed?.guards?.id) {
                    handleOpenReviewModal(firstUnreviewed.guards.id, firstUnreviewed.guards.full_name || 'Guard');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-star-line"></i>
                {unreviewedGuards.length > 1 ? `Review ${unreviewedGuards.length} Guards` : 'Leave a Review'}
              </button>
            )}
            {isCompleted && unreviewedGuards.length === 0 && reviewedGuards.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                <i className="ri-check-double-line text-emerald-400"></i>
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">All reviewed</span>
              </div>
            )}
            <button
              onClick={() => setShowComplaintModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-500/25 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-error-warning-line"></i>
              Raise Issue
            </button>
          </div>
        </header>

        {complaintSuccess && (
          <div className="mx-8 mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-lg"></i>
            </div>
            <p className="text-sm font-medium text-emerald-400">
              Your complaint has been submitted successfully. Our team will review it shortly.
            </p>
            <button onClick={() => setComplaintSuccess(false)} className="ml-auto w-5 h-5 flex items-center justify-center cursor-pointer">
              <i className="ri-close-line text-emerald-500"></i>
            </button>
          </div>
        )}

        {cancelSuccess && (
          <div className="mx-8 mt-4 bg-red-500/10 border border-red-500/25 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-close-circle-fill text-red-500 text-lg"></i>
            </div>
            <p className="text-sm font-medium text-red-400">
              Job cancelled successfully. You can request a refund from the Cancellation tab.
            </p>
            <button onClick={() => setCancelSuccess(false)} className="ml-auto w-5 h-5 flex items-center justify-center cursor-pointer">
              <i className="ri-close-line text-red-500"></i>
            </button>
          </div>
        )}

        {/* Confirmation Banner */}
        {needsConfirmation && (
          <div className="mx-8 mt-4 bg-violet-500/10 border border-violet-500/25 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-violet-500/15 rounded-xl shrink-0">
              <i className="ri-file-shield-line text-violet-500 text-2xl"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-violet-400">Booking awaiting your confirmation</p>
              <p className="text-xs text-violet-500">Payment is complete. Please review the details and confirm your booking.</p>
            </div>
            <Link href={`/client/jobs/${job.id}/confirmation`}>
              <button className="shrink-0 flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-file-shield-line"></i>
                Review & Confirm
              </button>
            </Link>
          </div>
        )}

        {isDisputed && (
          <div className="mx-8 mt-4 bg-orange-500/10 border border-orange-500/25 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-orange-500/15 rounded-xl shrink-0">
              <i className="ri-shield-flash-line text-orange-500 text-2xl"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-400">This booking is disputed</p>
              <p className="text-xs text-orange-500">Our support team is reviewing this case. You will be contacted shortly.</p>
            </div>
            <Link href="/client/support">
              <button className="shrink-0 flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-customer-service-2-line"></i>
                View Ticket
              </button>
            </Link>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <div className="flex gap-1 mb-4 sm:mb-6 bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-1 w-full sm:w-fit shadow-sm overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'complaints') {
                    setShowComplaintModal(true);
                  } else {
                    setActiveTab(tab.key as any);
                  }
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  tab.key === 'complaints'
                    ? 'text-red-400 hover:bg-red-500/10'
                    : activeTab === tab.key
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <JobInfoSection job={job} />
                </div>
                <div className="lg:col-span-1">
                  <JobCompliancePanel
                    guardsRequired={job?.number_of_guards || 0}
                    guardsSelected={assignedGuards.length}
                    compliantCount={compliantCount}
                    needsReviewCount={needsReviewCount}
                    requiredLicenceTypes={requiredLicenceTypes}
                    selectedGuardsCompliance={selectedGuardsCompliance}
                  />
                </div>
              </div>
              <ComplianceWarnings
                complianceList={selectedGuardsCompliance}
                guardNames={assignedGuards.map((a) => a.guards?.full_name || 'Guard')}
                guardsRequired={job?.number_of_guards || 0}
                guardsSelected={assignedGuards.length}
                requiredLicenceTypes={requiredLicenceTypes}
              />
            </div>
          )}
          {activeTab === 'guards' && (
            <AssignedGuardsSection
              guards={assignedGuards}
              isCompleted={isCompleted}
              jobId={jobId}
              onLeaveReview={handleOpenReviewModal}
              onMessageGuard={handleMessageGuard}
              requiredLicenceTypes={requiredLicenceTypes}
            />
          )}
          {activeTab === 'attendance' && (
            <AttendancePanel
              job={job}
              assignments={assignedGuards}
              clientId={clientId}
              onMessageGuard={handleMessageGuard}
            />
          )}
          {activeTab === 'timeline' && <JobTimeline events={timeline} />}
          {activeTab === 'confirmation' && (
            <div className="space-y-6">
              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-file-shield-line text-teal-400 text-lg"></i>
                  Booking Confirmation Status
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 text-center">
                    <p className="text-2xl font-bold text-slate-200">{assignedGuards.length}</p>
                    <p className="text-xs text-slate-500">Guards Selected</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 text-center">
                    <p className="text-2xl font-bold text-slate-200">{assignedGuards.filter(a => a.guard_confirmed_at).length}</p>
                    <p className="text-xs text-slate-500">Guards Confirmed</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 text-center">
                    <p className="text-2xl font-bold text-slate-200">{job.terms_accepted ? 'Yes' : 'No'}</p>
                    <p className="text-xs text-slate-500">Terms Accepted</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 text-center">
                    <p className="text-2xl font-bold text-slate-200">{job.client_confirmed ? 'Yes' : 'No'}</p>
                    <p className="text-xs text-slate-500">Client Confirmed</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <BookingStatusBadge status={job.status} size="lg" />
                  {job.booking_reference && (
                    <span className="bg-[#162036] border border-[#1e2d4d] text-slate-300 px-3 py-1 rounded-full text-xs font-mono">
                      {job.booking_reference}
                    </span>
                  )}
                </div>
                {needsConfirmation && (
                  <div className="mt-4">
                    <Link href={`/client/jobs/${job.id}/confirmation`}>
                      <button className="flex items-center gap-2 px-5 py-3 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-file-shield-line"></i>
                        Go to Confirmation Page
                      </button>
                    </Link>
                  </div>
                )}
                {isConfirmed && job.client_confirmed_at && (
                  <p className="mt-4 text-sm text-emerald-400">
                    <i className="ri-checkbox-circle-line mr-1"></i>
                    Booking confirmed on {new Date(job.client_confirmed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}
          {activeTab === 'cancellation' && (
            <CancellationRefundPanel
              job={job}
              cancellation={cancellation}
              refundRequests={refundRequests}
              transaction={transaction}
              onRequestRefund={() => setShowRefundModal(true)}
            />
          )}
        </main>
      </div>

      {showComplaintModal && (
        <ComplaintModal
          jobId={jobId}
          jobTitle={job.job_title}
          assignedGuards={assignedGuards}
          currentUserId={currentUserId}
          onClose={() => setShowComplaintModal(false)}
          onSuccess={handleComplaintSuccess}
        />
      )}

      {reviewModalOpen && reviewGuard && (
        <RateGuardModal
          jobId={jobId}
          guardId={reviewGuard.guardId}
          guardName={reviewGuard.guardName}
          jobTitle={job?.job_title}
          shiftDate={job?.start_date}
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={handleReviewSuccess}
        />
      )}

      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[#1e2d4d]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 rounded-xl">
                <i className="ri-checkbox-circle-line text-emerald-500 text-xl"></i>
              </div>
              <h2 className="text-lg font-bold text-white">Mark Job as Complete?</h2>
            </div>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to mark this job as complete? This will allow you to leave a review for your guard.
            </p>
            {completeError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
                {completeError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCompleteConfirm(false); setCompleteError(''); }}
                disabled={markingComplete}
                className="flex-1 px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkComplete}
                disabled={markingComplete}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {markingComplete ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating…
                  </>
                ) : (
                  <>
                    <i className="ri-checkbox-circle-line"></i>
                    Yes, Mark Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {messageGuard && (
        <MessageGuardModal
          guardName={messageGuard.guardName}
          guardId={messageGuard.guardId}
          guardUserId={messageGuard.guardUserId}
          jobId={jobId}
          onClose={() => setMessageGuard(null)}
          onSend={(msg, guardUserId, jobId) => handleSendMessage(msg, guardUserId, jobId)}
          sending={sendingMessage}
        />
      )}

      {showCancelModal && (
        <CancelJobModal
          job={job}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setCancelSuccess(true);
            setShowCancelModal(false);
            loadJobDetail();
            setTimeout(() => setCancelSuccess(false), 4000);
          }}
        />
      )}

      {showRefundModal && transaction && (
        <RefundRequestModal
          job={job}
          transaction={transaction}
          cancellation={cancellation}
          onClose={() => setShowRefundModal(false)}
          onSuccess={() => {
            setShowRefundModal(false);
            loadJobDetail();
          }}
        />
      )}
    </div>
  );
}