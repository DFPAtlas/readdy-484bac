'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NeedsAttentionBadge, { getAttentionItems } from './NeedsAttentionBadge';
import BookingStatusBadge from './BookingStatusBadge';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientJob } from '@/lib/client-types';

interface JobCardProps {
  job: ClientJob;
  paymentStatus?: string;
  markingCompleteId?: string | null;
  clientId?: string | null;
  onOpenDetail: (job: ClientJob) => void;
  onEdit: (job: ClientJob) => void;
  onDuplicate: (job: ClientJob) => void;
  onCancel: (job: ClientJob) => void;
  onMarkComplete: (job: ClientJob) => void;
  // Bulk selection support
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const cancellationStatusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  requested: { label: 'Cancellation Requested', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', icon: 'ri-time-line' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', icon: 'ri-close-circle-line' },
  refund_pending: { label: 'Refund Pending', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', icon: 'ri-hourglass-line' },
  refund_approved: { label: 'Refund Approved', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', icon: 'ri-check-double-line' },
  refund_rejected: { label: 'Refund Rejected', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/25', icon: 'ri-forbid-line' },
  credit_issued: { label: 'Credit Issued', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25', icon: 'ri-coupon-line' },
  under_admin_review: { label: 'Under Review', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', icon: 'ri-shield-user-line' },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400' },
  completed: { label: 'Paid', color: 'text-emerald-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
  refunded: { label: 'Refunded', color: 'text-slate-400' },
  disputed: { label: 'Disputed', color: 'text-orange-400' },
};

export default function JobCard({ job, paymentStatus, markingCompleteId, clientId, onOpenDetail, onEdit, onDuplicate, onCancel, onMarkComplete, selectable, selected, onToggleSelect }: JobCardProps) {
  const attention = getAttentionItems(job);
  const isCancelled = job.status === 'cancelled';
  const isCompleted = job.status === 'completed';
  const isActive = job.status === 'in_progress';
  const isConfirmed = job.status === 'confirmed';
  const needsConfirmation = job.status === 'awaiting_client_confirmation';
  const needsSelection = job.status === 'awaiting_guard_selection';
  const needsPayment = job.status === 'awaiting_payment';
  const isDisputed = job.status === 'disputed';

  const cancellationStatus = job.cancellation_status;
  const cancellationReason = job.cancellation_reason;
  const hasRefundPending = job.refund_status === 'pending';
  const hasRefundApproved = job.refund_status === 'approved' || job.refund_status === 'processed';

  const assigned = job.assigned_count || 0;
  const needed = job.number_of_guards || 1;
  const apps = job.applications_count || 0;

  const checkedIn = job.checked_in_count || 0;
  const late = job.late_count || 0;
  const noShow = job.no_show_count || 0;
  const hasAttendanceIssues = (checkedIn > 0 || late > 0 || noShow > 0 || job.issue_count > 0);

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const router = useRouter();
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const cid = clientId;
      if (!cid) return;
      await supabase.schema('app').from('job_templates').insert({
        client_id: cid,
        template_name: job.job_title || 'Job Template',
        job_title: job.job_title,
        security_type: job.security_type,
        number_of_guards: job.number_of_guards,
        hourly_rate: String(job.hourly_rate),
        venue: job.venue_name,
        city: job.venue_city,
        postcode: job.venue_postcode,
        job_description: job.job_description,
        special_instructions: job.special_instructions,
        experience_level: job.experience_level,
        uniform_required: job.uniform_required ? 'yes' : 'no',
        uniform_details: job.uniform_details,
        sia_licence_required: job.sia_licence_required ? 'yes' : 'no',
        required_licence_types: job.required_licence_types,
        urgency: job.urgency || 'standard',
      });
      setShowSaveTemplate(false);
    } catch {
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleRepost = () => {
    const searchParams = new URLSearchParams();
    if (job.venue_name) searchParams.set('site', job.venue_name);
    router.push(`/client/post-job?${searchParams.toString()}`);
  };

  return (
    <div className={`bg-[#111d35] rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${isCancelled || isDisputed ? 'border-red-500/25 opacity-75' : 'border-[#1e2d4d]'}`}>
      {/* Desktop layout */}
      <div className="hidden md:block p-5">
        <div className="flex items-start gap-4">
          {selectable && (
            <label className="flex items-center pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="w-4 h-4 rounded border-[#1e2d4d] bg-[#162036] text-teal-500 focus:ring-teal-500/20 cursor-pointer"
              />
            </label>
          )}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isCancelled ? 'bg-red-500/10' : isDisputed ? 'bg-orange-500/10' : 'bg-teal-500/15'}`}>
            <i className={`ri-briefcase-4-line text-xl ${isCancelled ? 'text-red-400' : isDisputed ? 'text-orange-400' : 'text-teal-400'}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className={`text-base font-bold truncate ${isCancelled || isDisputed ? 'text-slate-500' : 'text-slate-200'}`}>{job.job_title}</h3>
                  <BookingStatusBadge status={job.status} />
                  {job.is_featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-violet-500/10 text-violet-400 border-violet-500/25">
                      <i className="ri-vip-crown-line"></i>Featured
                    </span>
                  )}
                  {job.is_urgent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-500/10 text-red-400 border-red-500/25">
                      <i className="ri-flashlight-line"></i>Urgent
                    </span>
                  )}
                  {job.expires_at && new Date(job.expires_at) > new Date() && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/25">
                      <i className="ri-timer-flash-line"></i>Expires {new Date(job.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {job.is_draft && job.publish_at && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/25">
                      <i className="ri-calendar-schedule-line"></i>Publishes {new Date(job.publish_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {paymentStatus && (
                    <span className={`text-xs font-semibold ${paymentStatusConfig[paymentStatus]?.color || 'text-slate-400'}`}>
                      <i className="ri-secure-payment-line mr-1"></i>
                      {paymentStatusConfig[paymentStatus]?.label || paymentStatus}
                    </span>
                  )}
                  {cancellationStatus && cancellationStatusConfig[cancellationStatus] && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cancellationStatusConfig[cancellationStatus].bg} ${cancellationStatusConfig[cancellationStatus].text} ${cancellationStatusConfig[cancellationStatus].border}`}>
                      <i className={cancellationStatusConfig[cancellationStatus].icon}></i>
                      {cancellationStatusConfig[cancellationStatus].label}
                    </span>
                  )}
                  {hasRefundPending && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-500/10 text-orange-400 border-orange-500/25">
                      <i className="ri-hourglass-line"></i>
                      Refund Pending
                    </span>
                  )}
                  {hasRefundApproved && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                      <i className="ri-check-double-line"></i>
                      Refund Approved
                    </span>
                  )}
                  {job.booking_reference && (
                    <span className="bg-[#162036] border border-[#1e2d4d] text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-mono">
                      {job.booking_reference}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      {job.venue_city || job.postcode}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-line"></i>
                      {formatDate(job.start_date)}
                    </span>
                  </div>
                  {job.risk_level && (job.risk_level === 'high' || job.risk_level === 'urgent') && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      job.risk_level === 'urgent'
                        ? 'bg-red-500/15 text-red-400 border-red-500/25'
                        : 'bg-orange-500/15 text-orange-400 border-orange-500/25'
                    }`}>
                      <i className="ri-alert-line mr-0.5" />
                      {job.risk_level === 'urgent' ? 'Urgent' : 'High Risk'}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-teal-400">£{job.hourly_rate}/hr</p>
                <p className="text-xs text-slate-500">{needed} guard{needed !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 mb-3">
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="ri-user-received-line text-slate-600"></i>
                <span className="font-semibold text-slate-300">{apps}</span> applicant{apps !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="ri-user-follow-line text-slate-600"></i>
                <span className={`font-semibold ${assigned >= needed ? 'text-emerald-400' : 'text-amber-400'}`}>{assigned}</span>
                <span>/ {needed} selected</span>
              </span>
              {isActive && hasAttendanceIssues && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <i className="ri-pulse-line text-slate-600"></i>
                  <span className="flex items-center gap-1.5">
                    {checkedIn > 0 && (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {checkedIn} checked in
                      </span>
                    )}
                    {late > 0 && (
                      <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {late} late
                      </span>
                    )}
                    {noShow > 0 && (
                      <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                        {noShow} no-show
                      </span>
                    )}
                  </span>
                </span>
              )}
              {needsConfirmation && (
                <span className="flex items-center gap-1.5 text-sm text-violet-400">
                  <i className="ri-file-shield-line text-violet-500"></i>
                  <span className="font-semibold">Awaiting confirmation</span>
                </span>
              )}
              {isConfirmed && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <i className="ri-checkbox-circle-line text-emerald-500"></i>
                  <span className="font-semibold">Booking confirmed</span>
                </span>
              )}
              {isDisputed && (
                <span className="flex items-center gap-1.5 text-sm text-orange-400">
                  <i className="ri-shield-flash-line text-orange-500"></i>
                  <span className="font-semibold">Under dispute</span>
                </span>
              )}
              {attention.length > 0 && <NeedsAttentionBadge items={attention} compact />}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#1e2d4d]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenDetail(job)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line"></i>View
                </button>
                {!isCancelled && !isCompleted && !isDisputed && (
                  <button
                    onClick={() => onEdit(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line"></i>Edit
                  </button>
                )}
                <button
                  onClick={() => onDuplicate(job)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-copy-line"></i>Duplicate
                </button>
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-save-line"></i>Save Template
                </button>
                {(isCompleted || isCancelled || isDisputed) && (
                  <button
                    onClick={() => setShowRepostModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-refresh-line"></i>Repost
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {needsConfirmation && (
                  <Link href={`/client/jobs/${job.id}/confirmation`}>
                    <button className="flex items-center gap-1.5 bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-file-shield-line"></i>Confirm Booking
                    </button>
                  </Link>
                )}
                {needsSelection && apps > 0 && (
                  <Link href={`/client/jobs/${job.id}/select-guards`}>
                    <button className="flex items-center gap-1.5 bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-user-search-line"></i>Select Guards
                    </button>
                  </Link>
                )}
                {needsPayment && (
                  <Link href={`/client/jobs/${job.id}/payment`}>
                    <button className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-secure-payment-line"></i>Pay Now
                    </button>
                  </Link>
                )}
                {isActive && (
                  <button
                    onClick={() => onMarkComplete(job)}
                    disabled={markingCompleteId === job.id}
                    className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    {markingCompleteId === job.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <i className="ri-checkbox-circle-line"></i>
                    )}
                    Mark Complete
                  </button>
                )}
                {isCompleted && (
                  <Link href={`/client/jobs/${job.id}`}>
                    <button className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-star-line"></i>Leave Review
                    </button>
                  </Link>
                )}
                {isCancelled && !hasRefundPending && !hasRefundApproved && (
                  <Link href={`/client/jobs/${job.id}`}>
                    <button className="flex items-center gap-1.5 bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-refund-line"></i>Request Refund
                    </button>
                  </Link>
                )}
                {hasRefundPending && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-500/25 text-orange-400">
                    <i className="ri-hourglass-line"></i>Refund Pending
                  </div>
                )}
                {hasRefundApproved && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/25 text-emerald-400">
                    <i className="ri-check-double-line"></i>Refunded
                  </div>
                )}
                {!isCancelled && !isCompleted && !isDisputed && (
                  <button
                    onClick={() => onCancel(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-close-circle-line"></i>Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden p-4">
        <div className="flex items-start gap-3 mb-3">
          {selectable && (
            <label className="flex items-center pt-1 cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="w-4 h-4 rounded border-[#1e2d4d] bg-[#162036] text-teal-500 focus:ring-teal-500/20 cursor-pointer"
              />
            </label>
          )}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isCancelled ? 'bg-red-500/10' : isDisputed ? 'bg-orange-500/10' : 'bg-teal-500/15'}`}>
            <i className={`ri-briefcase-4-line text-lg ${isCancelled ? 'text-red-400' : isDisputed ? 'text-orange-400' : 'text-teal-400'}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-200 truncate">{job.job_title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <BookingStatusBadge status={job.status} />
              {paymentStatus && (
                <span className={`text-xs font-semibold ${paymentStatusConfig[paymentStatus]?.color || 'text-slate-400'}`}>
                  <i className="ri-secure-payment-line mr-0.5"></i>
                  {paymentStatusConfig[paymentStatus]?.label || paymentStatus}
                </span>
              )}
              {cancellationStatus && cancellationStatusConfig[cancellationStatus] && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cancellationStatusConfig[cancellationStatus].bg} ${cancellationStatusConfig[cancellationStatus].text} ${cancellationStatusConfig[cancellationStatus].border}`}>
                  <i className={cancellationStatusConfig[cancellationStatus].icon}></i>
                  {cancellationStatusConfig[cancellationStatus].label}
                </span>
              )}
              {hasRefundPending && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-500/10 text-orange-400 border-orange-500/25">
                  <i className="ri-hourglass-line"></i>Refund Pending
                </span>
              )}
              {hasRefundApproved && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                  <i className="ri-check-double-line"></i>Refunded
                </span>
              )}
              {job.booking_reference && (
                <span className="bg-[#162036] border border-[#1e2d4d] text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  {job.booking_reference}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-500 mb-3">
          <div className="flex items-center gap-1.5">
            <i className="ri-map-pin-line text-slate-600"></i>
            {job.venue_name ? `${job.venue_name}, ${job.venue_city}` : job.venue_city}
          </div>
          <div className="flex items-center gap-1.5">
            <i className="ri-calendar-line text-slate-600"></i>
            {formatDate(job.start_date)}
          </div>
          <div className="flex items-center gap-1.5">
            <i className="ri-time-line text-slate-600"></i>
            {job.start_time?.slice(0, 5)} – {job.end_time?.slice(0, 5)}
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><i className="ri-user-received-line text-slate-600"></i>{apps} applicants</span>
              <span className="flex items-center gap-1"><i className="ri-user-follow-line text-slate-600"></i>{assigned}/{needed} selected</span>
            </span>
            <span className="font-bold text-teal-400">£{job.hourly_rate}/hr</span>
          </div>
        </div>

        {isActive && hasAttendanceIssues && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {checkedIn > 0 && (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {checkedIn} checked in
              </span>
            )}
            {late > 0 && (
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {late} late
              </span>
            )}
            {noShow > 0 && (
              <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                {noShow} no-show
              </span>
            )}
          </div>
        )}

        {needsConfirmation && (
          <div className="mt-2 text-xs font-semibold text-violet-400">
            <i className="ri-file-shield-line mr-1"></i>Awaiting your confirmation
          </div>
        )}
        {isConfirmed && (
          <div className="mt-2 text-xs font-semibold text-emerald-400">
            <i className="ri-checkbox-circle-line mr-1"></i>Booking confirmed
          </div>
        )}
        {isDisputed && (
          <div className="mt-2 text-xs font-semibold text-orange-400">
            <i className="ri-shield-flash-line mr-1"></i>Under dispute
          </div>
        )}

        {attention.length > 0 && (
          <div className="mb-3">
            <NeedsAttentionBadge items={attention} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#1e2d4d]">
          <button
            onClick={() => onOpenDetail(job)}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] cursor-pointer whitespace-nowrap"
          >
            <i className="ri-eye-line"></i>Details
          </button>
          {!isCancelled && !isCompleted && !isDisputed && (
            <button
              onClick={() => onEdit(job)}
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] cursor-pointer whitespace-nowrap"
            >
              <i className="ri-edit-line"></i>Edit
            </button>
          )}
          <button
            onClick={() => onDuplicate(job)}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-copy-line"></i>Copy
          </button>
          {needsConfirmation && (
            <Link href={`/client/jobs/${job.id}/confirmation`} className="flex-1 min-w-[80px]">
              <button className="w-full flex items-center justify-center gap-1 bg-violet-500 text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                <i className="ri-file-shield-line"></i>Confirm
              </button>
            </Link>
          )}
          {needsSelection && apps > 0 && (
            <Link href={`/client/jobs/${job.id}/select-guards`} className="flex-1 min-w-[80px]">
              <button className="w-full flex items-center justify-center gap-1 bg-teal-500 text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                <i className="ri-user-search-line"></i>Select
              </button>
            </Link>
          )}
          {needsPayment && (
            <Link href={`/client/jobs/${job.id}/payment`} className="flex-1 min-w-[80px]">
              <button className="w-full flex items-center justify-center gap-1 bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                <i className="ri-secure-payment-line"></i>Pay
              </button>
            </Link>
          )}
          {isActive && (
            <button
              onClick={() => onMarkComplete(job)}
              disabled={markingCompleteId === job.id}
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {markingCompleteId === job.id ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="ri-checkbox-circle-line"></i>
              )}
              Complete
            </button>
          )}
          {isCancelled && !hasRefundPending && !hasRefundApproved && (
            <Link href={`/client/jobs/${job.id}`} className="flex-1 min-w-[80px]">
              <button className="w-full flex items-center justify-center gap-1 bg-violet-500 text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                <i className="ri-refund-line"></i>Refund
              </button>
            </Link>
          )}
          {hasRefundPending && (
            <div className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border border-orange-500/25 text-orange-400 cursor-pointer whitespace-nowrap">
              <i className="ri-hourglass-line"></i>Refund Pending
            </div>
          )}
          {hasRefundApproved && (
            <div className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-500/25 text-emerald-400 cursor-pointer whitespace-nowrap">
              <i className="ri-check-double-line"></i>Refunded
            </div>
          )}
          {!isCancelled && !isCompleted && !isDisputed && (
            <button
              onClick={() => onCancel(job)}
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border border-red-500/25 text-red-400 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-close-circle-line"></i>Cancel
            </button>
          )}
        </div>
      </div>

      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-6 border border-[#1e2d4d]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <i className="ri-file-copy-line text-2xl text-indigo-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Save as Template</h2>
                <p className="text-sm text-slate-500">Reuse this job configuration later</p>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Template Name *</label>
              <input
                type="text"
                defaultValue={job.job_title || 'Job Template'}
                id="template-name-input"
                placeholder="e.g., Weekend Door Supervisor"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="flex-1 bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {savingTemplate ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>
                    Save Template
                  </>
                )}
              </button>
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-lg font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRepostModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-6 border border-[#1e2d4d]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/25">
                <i className="ri-refresh-line text-xl text-teal-400"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Repost Job</h2>
                <p className="text-sm text-slate-500">Create a new job with these details</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  onDuplicate(job);
                  setShowRepostModal(false);
                }}
                className="w-full text-left p-4 rounded-xl border border-[#1e2d4d] hover:border-teal-500/30 hover:bg-[#162036] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <i className="ri-file-copy-line text-teal-400 text-lg"></i>
                  <div>
                    <p className="text-sm font-semibold text-white">Duplicate with New Dates</p>
                    <p className="text-xs text-slate-500">Copy everything, update dates and times</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowRepostModal(false);
                  router.push(`/client/post-job?site=${job.id}`);
                }}
                className="w-full text-left p-4 rounded-xl border border-[#1e2d4d] hover:border-teal-500/30 hover:bg-[#162036] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <i className="ri-building-line text-teal-400 text-lg"></i>
                  <div>
                    <p className="text-sm font-semibold text-white">Use This Site</p>
                    <p className="text-xs text-slate-500">Start a fresh job at {job.venue_name}</p>
                  </div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowRepostModal(false)}
              className="w-full py-3 border border-[#1e2d4d] text-slate-300 rounded-lg font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}