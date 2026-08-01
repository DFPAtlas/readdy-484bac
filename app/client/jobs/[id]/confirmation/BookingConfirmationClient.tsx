'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import BookingStatusBadge from '../../BookingStatusBadge';
import ConfirmationBlockers from './ConfirmationBlockers';
import BookingReceiptModal from './BookingReceiptModal';
import { useClientGuard } from '@/hooks/useClientGuard';
import { sendPushToUser } from '@/lib/push-notifications';

interface Guard {
  id: string;
  full_name: string;
  profile_photo_url: string | null;
  sia_licence_number: string | null;
  sia_verified: boolean;
  average_rating: number | null;
  total_reviews: number | null;
  phone: string | null;
  user_id: string | null;
}

interface Assignment {
  id: string;
  guard_id: string;
  status: string;
  guard_confirmed_at: string | null;
  guards: Guard;
}

interface Job {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  hourly_rate: number;
  status: string;
  job_description: string;
  special_instructions: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  booking_reference: string | null;
  client_confirmed: boolean;
  client_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  risk_level: string | null;
  sia_licence_required: boolean;
  uniform_required: boolean;
  venue_address_line1: string;
  venue_address_line2: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface Transaction {
  id: string;
  status: string;
  amount: number;
  created_at: string;
  completed_at: string | null;
  payment_method: string | null;
  receipt_url: string | null;
}

export default function BookingConfirmationClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Basic');
  const [initials, setInitials] = useState('CL');
  const [clientId, setClientId] = useState('');
  const [authUserId, setAuthUserId] = useState('');

  const [termsBooking, setTermsBooking] = useState(false);
  const [termsCancellation, setTermsCancellation] = useState(false);
  const [termsSite, setTermsSite] = useState(false);
  const [termsPayment, setTermsPayment] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [confirmedAt, setConfirmedAt] = useState('');
  const [toast, setToast] = useState('');

  const [hours, setHours] = useState(0);
  const [days, setDays] = useState(1);
  const [guardPay, setGuardPay] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [vat, setVat] = useState(0);
  const [total, setTotal] = useState(0);

  function getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const calculateHours = (startTime: string, endTime: string, startDate: string, endDate?: string | null) => {
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate || startDate}T${endTime}`);
    let h = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (h < 0) h += 24;
    const d = Math.max(1, Math.ceil((new Date(endDate || startDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return { hours: h, days: d, totalHours: h * d };
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/client/login'); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, subscription_tier, email, phone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }

      setClientId(client.id);
      setAuthUserId(user.id);
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

      const { data: assignmentsData } = await supabase
        .from('job_assignments')
        .select('*, guards(id, full_name, profile_photo_url, sia_licence_number, sia_verified, average_rating, total_reviews, phone, user_id)')
        .eq('job_id', jobId);

      setAssignments(assignmentsData || []);

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('job_id', jobId)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTransaction(txData || null);

      const { hours: h, days: d, totalHours } = calculateHours(
        jobData.start_time,
        jobData.end_time,
        jobData.start_date,
        jobData.end_date
      );
      const gp = totalHours * (jobData.number_of_guards || 1) * (jobData.hourly_rate || 0);
      const sf = gp * 0.10;
      const v = (gp + sf) * 0.20;
      const t = gp + sf + v;
      setHours(totalHours);
      setDays(d);
      setGuardPay(Math.round(gp * 100) / 100);
      setServiceFee(Math.round(sf * 100) / 100);
      setVat(Math.round(v * 100) / 100);
      setTotal(Math.round(t * 100) / 100);

      if (jobData.terms_accepted) {
        setTermsBooking(true);
        setTermsCancellation(true);
        setTermsSite(true);
        setTermsPayment(true);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [jobId]);

  const generateBookingRef = () => {
    const date = new Date();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `QG-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${random}`;
  };

  const handleConfirm = async () => {
    if (!job) return;
    setConfirming(true);
    setConfirmError('');

    try {
      const ref = job.booking_reference || generateBookingRef();
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'confirmed',
          terms_accepted: true,
          terms_accepted_at: now,
          booking_reference: ref,
          client_confirmed: true,
          client_confirmed_at: now,
          updated_at: now,
        })
        .eq('id', jobId)
        .eq('client_id', clientId);

      if (updateError) throw updateError;

      setBookingRef(ref);
      setConfirmedAt(now);
      setShowReceipt(true);
      setJob((prev: any) => prev ? {
        ...prev,
        status: 'confirmed',
        terms_accepted: true,
        terms_accepted_at: now,
        booking_reference: ref,
        client_confirmed: true,
        client_confirmed_at: now,
      } : null);

      await supabase.from('notifications').insert({
        user_id: authUserId,
        user_type: 'client',
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: `Your booking "${job.job_title}" has been confirmed. Reference: ${ref}`,
        link: `/client/jobs/${jobId}`,
        is_read: false,
      });

      for (const a of assignments) {
        if (a.guards?.user_id) {
          try {
            await sendPushToUser(a.guards.user_id, 'guard', {
              title: 'Booking Confirmed',
              body: `Client has confirmed "${job.job_title}". Please arrive on time.`,
              url: '/guard/dashboard',
              tag: 'quickguard-confirmed',
            });
          } catch (e) {
            console.error('Failed to send confirmation push:', e);
          }
        }
      }

      setToast('Booking confirmed successfully!');
      setTimeout(() => setToast(''), 4000);
    } catch (e: any) {
      setConfirmError(e.message || 'Failed to confirm booking. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDispute = async () => {
    if (!job) return;
    try {
      await supabase
        .from('jobs')
        .update({
          status: 'disputed',
          disputed: true,
          disputed_at: new Date().toISOString(),
          disputed_reason: 'Client disputed before confirmation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('client_id', clientId);

      await supabase.from('support_tickets').insert({
        client_id: clientId,
        related_job_id: jobId,
        subject: `Booking Disputed: ${job.job_title}`,
        description: 'Client has disputed this booking before final confirmation.',
        status: 'open',
        priority: 'high',
      });

      await supabase.from('notifications').insert({
        user_id: authUserId,
        user_type: 'client',
        type: 'booking_disputed',
        title: 'Booking Disputed',
        message: `Your booking "${job.job_title}" has been marked as disputed. Support will contact you shortly.`,
        link: `/client/support`,
        is_read: false,
      });

      setJob((prev: any) => prev ? { ...prev, status: 'disputed', disputed: true } : null);
      setToast('Booking disputed. Support will contact you shortly.');
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast('Failed to dispute booking. Please try again.');
    }
  };

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const formatDateTime = (d: string) =>
    d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const allTermsAccepted = termsBooking && termsCancellation && termsSite && termsPayment;
  const paymentComplete = transaction?.status === 'completed' || transaction?.status === 'succeeded' || job?.status === 'awaiting_client_confirmation' || job?.status === 'confirmed' || job?.status === 'in_progress';
  const isConfirmed = job?.status === 'confirmed' || job?.status === 'in_progress' || job?.status === 'completed';
  const isDisputed = job?.status === 'disputed';
  const isCancelled = job?.status === 'cancelled';
  const guardsSelected = assignments.length;
  const guardsRequired = job?.number_of_guards || 0;
  const guardsConfirmed = assignments.filter(a => a.guard_confirmed_at).length;

  const blockers = [];
  if (guardsSelected === 0) blockers.push({ icon: 'ri-user-unfollow-line', text: 'No guards selected for this job' });
  if (guardsSelected < guardsRequired) blockers.push({ icon: 'ri-user-add-line', text: `Only ${guardsSelected} of ${guardsRequired} required guards selected` });
  if (!paymentComplete) blockers.push({ icon: 'ri-secure-payment-line', text: 'Payment is required before confirmation' });
  if (!allTermsAccepted) blockers.push({ icon: 'ri-file-list-3-line', text: 'You must accept all terms and conditions' });
  if (!job?.venue_address_line1) blockers.push({ icon: 'ri-map-pin-line', text: 'Site address is missing' });
  if (!job?.start_time || !job?.end_time) blockers.push({ icon: 'ri-time-line', text: 'Shift times are not set' });
  if (assignments.some(a => !a.guards?.sia_verified)) blockers.push({ icon: 'ri-shield-flash-line', text: 'Selected guard has a critical compliance issue (SIA not verified)' });

  const canConfirm = blockers.length === 0 && !isConfirmed && !isDisputed && !isCancelled;

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading booking confirmation...</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName || 'Client'}
        subtitle={subscriptionTier || 'Free'}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Link href={`/client/jobs/${jobId}`} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] transition-colors cursor-pointer">
              <i className="ri-arrow-left-line text-slate-400 text-base"></i>
            </Link>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Booking Confirmation</p>
              <h1 className="text-xl font-bold text-white truncate max-w-md">{job.job_title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <BookingStatusBadge status={job.status} />
            {job.booking_reference && (
              <span className="bg-[#162036] border border-[#1e2d4d] text-slate-300 px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap">
                {job.booking_reference}
              </span>
            )}
          </div>
        </header>

        {toast && (
          <div className="mx-8 mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-lg"></i>
            </div>
            <p className="text-sm font-medium text-emerald-400">{toast}</p>
            <button onClick={() => setToast('')} className="ml-auto w-5 h-5 flex items-center justify-center cursor-pointer">
              <i className="ri-close-line text-emerald-500"></i>
            </button>
          </div>
        )}

        {isConfirmed && (
          <div className="mx-8 mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-emerald-500/15 rounded-xl shrink-0">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-2xl"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400">This booking is confirmed</p>
              <p className="text-xs text-emerald-500">
                Confirmed on {formatDateTime(job.client_confirmed_at || job.updated_at)}
                {job.booking_reference && ` · Reference: ${job.booking_reference}`}
              </p>
            </div>
            <button
              onClick={() => setShowReceipt(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-file-list-3-line"></i>
              View Receipt
            </button>
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
                View Support Ticket
              </button>
            </Link>
          </div>
        )}

        {isCancelled && (
          <div className="mx-8 mt-4 bg-red-500/10 border border-red-500/25 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-red-500/15 rounded-xl shrink-0">
              <i className="ri-close-circle-fill text-red-500 text-2xl"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400">This booking has been cancelled</p>
              <p className="text-xs text-red-500">No further action is required.</p>
            </div>
          </div>
        )}

        <main className="flex-1 px-8 py-8">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Confirmation Blockers */}
            {!isConfirmed && !isDisputed && !isCancelled && (
              <ConfirmationBlockers blockers={blockers} />
            )}

            {/* Booking Summary */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 p-6 border-b border-[#1e2d4d]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-teal-400 text-sm font-medium">Booking Review</p>
                    <h2 className="text-2xl font-bold text-white mt-1">{job.job_title}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-teal-400 text-sm">Total Cost</p>
                    <p className="text-3xl font-bold text-white">£{total.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <i className="ri-file-info-line text-teal-400"></i>
                    Job Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                      <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                        <i className="ri-map-pin-2-line text-teal-400"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Location</p>
                        <p className="text-sm font-semibold text-slate-200">{job.venue_name}</p>
                        <p className="text-xs text-slate-500">{[job.venue_address_line1, job.venue_address_line2, job.venue_city, job.venue_postcode].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                      <div className="w-8 h-8 flex items-center justify-center bg-emerald-500/15 rounded-lg flex-shrink-0">
                        <i className="ri-calendar-event-line text-emerald-400"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Shift Date</p>
                        <p className="text-sm font-semibold text-slate-200">{formatDate(job.start_date)}{job.end_date && job.end_date !== job.start_date ? ` - ${formatDate(job.end_date)}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                      <div className="w-8 h-8 flex items-center justify-center bg-violet-500/15 rounded-lg flex-shrink-0">
                        <i className="ri-time-line text-violet-400"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Shift Time</p>
                        <p className="text-sm font-semibold text-slate-200">{job.start_time?.slice(0, 5)} - {job.end_time?.slice(0, 5)}</p>
                        <p className="text-xs text-slate-500">{hours.toFixed(1)} hours total · {days} day{days !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                      <div className="w-8 h-8 flex items-center justify-center bg-amber-500/15 rounded-lg flex-shrink-0">
                        <i className="ri-group-line text-amber-400"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Guards Required</p>
                        <p className="text-sm font-semibold text-slate-200">{job.number_of_guards} guard{job.number_of_guards !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-slate-500">{guardsSelected} selected · {guardsConfirmed} confirmed by guard</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                      <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                        <i className="ri-money-pound-circle-line text-teal-400"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Hourly Rate</p>
                        <p className="text-sm font-semibold text-slate-200">£{job.hourly_rate}/hr</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <i className="ri-secure-payment-line text-teal-400"></i>
                    Payment Summary
                  </h3>
                  <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Guard Fees</span>
                      <span className="text-slate-200 font-semibold">£{guardPay.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Platform / Service Fee (10%)</span>
                      <span className="text-slate-200 font-semibold">£{serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">VAT (20%)</span>
                      <span className="text-slate-200 font-semibold">£{vat.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-[#1e2d4d] pt-3 flex justify-between">
                      <span className="text-white font-semibold">Total Payable</span>
                      <span className="text-teal-400 font-bold text-lg">£{total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <i className="ri-shield-user-line text-teal-400"></i>
                      Selected Guards
                    </h3>
                    {assignments.length === 0 ? (
                      <div className="p-4 bg-[#162036] rounded-xl border border-[#1e2d4d] text-center">
                        <p className="text-sm text-slate-500">No guards selected yet</p>
                        <Link href={`/client/jobs/${jobId}/select-guards`}>
                          <button className="mt-2 text-teal-400 text-sm font-semibold hover:text-teal-300 cursor-pointer whitespace-nowrap">
                            Select Guards <i className="ri-arrow-right-line text-xs"></i>
                          </button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignments.map((a) => {
                          const g = a.guards;
                          const initials = g?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '??';
                          const isConfirmed = !!a.guard_confirmed_at;
                          return (
                            <div key={a.id} className="flex items-center gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                              <div className="w-10 h-10 rounded-full bg-[#111d35] flex items-center justify-center overflow-hidden border border-[#1e2d4d] flex-shrink-0">
                                {g?.profile_photo_url ? (
                                  <img src={g.profile_photo_url} alt={initials} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-teal-400 font-bold text-xs">{initials}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-200 truncate">{g?.full_name || 'Unknown Guard'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {g?.sia_verified && (
                                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                      <i className="ri-shield-check-line mr-0.5"></i>SIA Verified
                                    </span>
                                  )}
                                  {g?.average_rating && g.average_rating > 0 && (
                                    <span className="text-[10px] text-amber-400 font-semibold">
                                      <i className="ri-star-fill mr-0.5"></i>{g.average_rating.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${isConfirmed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'}`}>
                                {isConfirmed ? 'Guard Confirmed' : 'Awaiting Confirmation'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <i className="ri-secure-payment-line text-teal-400"></i>
                      Payment Status
                    </h3>
                    <div className={`p-4 rounded-xl border ${paymentComplete ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${paymentComplete ? 'bg-emerald-500/15' : 'bg-amber-500/15'}">
                          <i className={`text-xl ${paymentComplete ? 'ri-checkbox-circle-fill text-emerald-500' : 'ri-time-line text-amber-500'}`}></i>
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${paymentComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {paymentComplete ? 'Payment Complete' : 'Payment Required'}
                          </p>
                          {transaction && (
                            <p className="text-xs text-slate-500">
                              {transaction.payment_method || 'Card'} · £{transaction.amount} · {formatDateTime(transaction.created_at)}
                            </p>
                          )}
                          {!paymentComplete && !isConfirmed && (
                            <Link href={`/client/jobs/${jobId}/payment`}>
                              <button className="mt-2 text-xs font-semibold text-teal-400 hover:text-teal-300 cursor-pointer whitespace-nowrap">
                                <i className="ri-secure-payment-line mr-1"></i>Pay Now
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            {!isConfirmed && !isDisputed && !isCancelled && (
              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
                <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                  <div className="w-7 h-7 flex items-center justify-center">
                    <i className="ri-file-shield-line text-teal-400 text-lg"></i>
                  </div>
                  Terms & Agreement
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                  Before confirming this booking, please review and accept the following terms. These protect both you and the guards assigned to your site.
                </p>

                <div className="space-y-3">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${termsBooking ? 'bg-teal-500/10 border-teal-500/25' : 'bg-[#162036] border-[#1e2d4d] hover:border-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={termsBooking}
                      onChange={(e) => setTermsBooking(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-teal-500 rounded border-[#1e2d4d]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Booking Terms</p>
                      <p className="text-xs text-slate-500 mt-1">
                        I confirm that the job details are accurate and I have authority to book security services for this site.
                        {/* TODO: Link to formal booking terms page when available */}
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${termsCancellation ? 'bg-teal-500/10 border-teal-500/25' : 'bg-[#162036] border-[#1e2d4d] hover:border-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={termsCancellation}
                      onChange={(e) => setTermsCancellation(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-teal-500 rounded border-[#1e2d4d]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Cancellation & Refund Terms</p>
                      <p className="text-xs text-slate-500 mt-1">
                        I understand the cancellation policy: cancellations within 24 hours may incur a fee. Full refunds are available for cancellations made 48+ hours before the shift start.
                        {/* TODO: Link to formal cancellation policy when available */}
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${termsSite ? 'bg-teal-500/10 border-teal-500/25' : 'bg-[#162036] border-[#1e2d4d] hover:border-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={termsSite}
                      onChange={(e) => setTermsSite(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-teal-500 rounded border-[#1e2d4d]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Site Responsibility Statement</p>
                      <p className="text-xs text-slate-500 mt-1">
                        I confirm that the site is safe for guards to work, access instructions are accurate, and I will provide emergency contact details if not already provided.
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${termsPayment ? 'bg-teal-500/10 border-teal-500/25' : 'bg-[#162036] border-[#1e2d4d] hover:border-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={termsPayment}
                      onChange={(e) => setTermsPayment(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-teal-500 rounded border-[#1e2d4d]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Payment Responsibility Statement</p>
                      <p className="text-xs text-slate-500 mt-1">
                        I understand that payment is required before the shift starts. I am responsible for any additional costs arising from extended hours or replacement guards.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Confirmation History / Timeline */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
              <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center">
                  <i className="ri-time-line text-teal-400 text-lg"></i>
                </div>
                Confirmation History
              </h2>
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[#1e2d4d]"></div>
                <div className="space-y-4">
                  {[
                    { label: 'Job created', date: job.created_at, icon: 'ri-file-add-line', color: 'bg-blue-500', done: true },
                    { label: `${job.applications_count || 0} applicant${(job.applications_count || 0) !== 1 ? 's' : ''} received`, date: job.updated_at, icon: 'ri-user-received-line', color: 'bg-violet-500', done: (job.applications_count || 0) > 0 },
                    { label: `${guardsSelected} guard${guardsSelected !== 1 ? 's' : ''} selected`, date: assignments[0]?.assigned_at || job.updated_at, icon: 'ri-user-follow-line', color: 'bg-teal-500', done: guardsSelected > 0 },
                    { label: 'Payment completed', date: transaction?.completed_at || transaction?.created_at, icon: 'ri-secure-payment-line', color: 'bg-emerald-500', done: paymentComplete },
                    { label: 'Terms accepted', date: job.terms_accepted_at, icon: 'ri-file-shield-line', color: 'bg-teal-500', done: job.terms_accepted },
                    { label: 'Booking confirmed', date: job.client_confirmed_at, icon: 'ri-checkbox-circle-line', color: 'bg-emerald-500', done: isConfirmed },
                    { label: `${guardsConfirmed} guard confirmation${guardsConfirmed !== 1 ? 's' : ''} received`, date: assignments.find(a => a.guard_confirmed_at)?.guard_confirmed_at, icon: 'ri-check-double-line', color: 'bg-blue-500', done: guardsConfirmed > 0 },
                  ].map((event, index) => (
                    <div key={index} className="flex items-start gap-4 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${event.done ? event.color : 'bg-[#162036] border border-[#1e2d4d]'}`}>
                        <i className={`${event.icon} text-white text-sm`}></i>
                      </div>
                      <div className={`flex-1 rounded-xl p-3 border min-w-0 ${event.done ? 'bg-[#162036] border-[#1e2d4d]' : 'bg-[#162036]/50 border-dashed border-[#1e2d4d]'}`}>
                        <p className={`text-sm font-semibold ${event.done ? 'text-slate-200' : 'text-slate-600'}`}>{event.label}</p>
                        {event.date && event.done && (
                          <p className="text-xs text-slate-500 mt-1">{formatDateTime(event.date)}</p>
                        )}
                        {!event.done && (
                          <p className="text-xs text-slate-600 mt-1">Pending</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            {!isConfirmed && !isDisputed && !isCancelled && (
              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-200">
                      {canConfirm ? 'Ready to confirm?' : 'Action required before confirming'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {canConfirm
                        ? 'All requirements are met. Click the button below to confirm your booking.'
                        : `Please resolve the ${blockers.length} blocker${blockers.length !== 1 ? 's' : ''} above.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDispute}
                      disabled={confirming}
                      className="flex items-center gap-2 px-4 py-2.5 border border-orange-500/25 text-orange-400 rounded-xl text-sm font-semibold hover:bg-orange-500/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <i className="ri-shield-flash-line"></i>
                      Dispute
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={!canConfirm || confirming}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                        canConfirm
                          ? 'bg-teal-500 text-white hover:bg-teal-600'
                          : 'bg-[#162036] text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {confirming ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Confirming...
                        </>
                      ) : (
                        <>
                          <i className="ri-checkbox-circle-line"></i>
                          Confirm Booking
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {confirmError && (
                  <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
                    {confirmError}
                  </div>
                )}
              </div>
            )}

            {/* Post-confirmation actions */}
            {isConfirmed && (
              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-tools-line text-teal-400"></i>
                  Next Steps
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="flex items-center gap-2 px-4 py-3 bg-[#162036] border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-download-line text-teal-400"></i>
                    Download Confirmation
                  </button>
                  <Link href="/client/messages">
                    <button className="w-full flex items-center gap-2 px-4 py-3 bg-[#162036] border border-[#1e2d4d] text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-message-3-line"></i>
                      Message Guards
                    </button>
                  </Link>
                  <Link href={`/client/jobs/${jobId}`}>
                    <button className="w-full flex items-center gap-2 px-4 py-3 bg-[#162036] border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-eye-line text-teal-400"></i>
                      View Job
                    </button>
                  </Link>
                  <Link href="/client/jobs/tracker">
                    <button className="w-full flex items-center gap-2 px-4 py-3 bg-[#162036] border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-radar-line text-teal-400"></i>
                      Live Tracker
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {showReceipt && job && (
        <BookingReceiptModal
          job={job}
          assignments={assignments}
          transaction={transaction}
          costs={{ guardPay, serviceFee, vat, total, hours, days }}
          bookingRef={bookingRef || job.booking_reference || ''}
          confirmedAt={confirmedAt || job.client_confirmed_at || job.updated_at}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}