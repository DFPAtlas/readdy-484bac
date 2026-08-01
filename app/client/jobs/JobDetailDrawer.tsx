'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import ReviewStatusBadge from '@/components/reviews/ReviewStatusBadge';

interface JobDetailDrawerProps {
  job: any;
  clientId?: string | null;
  onClose: () => void;
}

export default function JobDetailDrawer({ job, clientId, onClose }: JobDetailDrawerProps) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [guardReviews, setGuardReviews] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [cancellation, setCancellation] = useState<any>(null);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);

  useEffect(() => {
    loadDetails();
  }, [job.id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, transactionsRes, reviewsRes, cancellationRes, refundRes] = await Promise.all([
        supabase
          .from('job_assignments')
          .select('*, guards(id, full_name, profile_photo_url, sia_licence_number, phone, average_rating, total_reviews, total_jobs_completed)')
          .eq('job_id', job.id),
        supabase
          .from('transactions')
          .select('*')
          .eq('job_id', job.id)
          .order('created_at', { ascending: false })
          .limit(5),
        clientId ? supabase
          .from('reviews')
          .select('guard_id, rating, review_status, issue_reported')
          .eq('job_id', job.id)
          .eq('client_id', clientId) : Promise.resolve({ data: [] }),
        supabase
          .schema('app')
          .from('job_cancellations')
          .select('*')
          .eq('job_id', job.id)
          .maybeSingle(),
        supabase
          .schema('app')
          .from('refund_requests')
          .select('*')
          .eq('job_id', job.id)
          .order('created_at', { ascending: false }),
      ]);
      setAssignments(assignmentsRes.data || []);
      setTransactions(transactionsRes.data || []);
      setCancellation(cancellationRes.data || null);
      setRefundRequests(refundRes.data || []);

      const reviewMap: Record<string, any> = {};
      (reviewsRes.data || []).forEach((r: any) => {
        if (r.guard_id) reviewMap[r.guard_id] = r;
      });
      setGuardReviews(reviewMap);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const formatDateTime = (d: string) =>
    d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const latestTransaction = transactions[0];
  const isCompleted = job.status === 'completed';
  const isCancelled = job.status === 'cancelled';
  const unreviewedCount = assignments.filter((a) => a.guards?.id && !guardReviews[a.guards.id]).length;

  const [sh, sm] = (job.start_time || '00:00').split(':').map(Number);
  const [eh, em] = (job.end_time || '00:00').split(':').map(Number);
  let hours = (eh * 60 + em - sh * 60 - sm) / 60;
  if (hours <= 0) hours += 24;
  const days = Math.max(1, job.number_of_days || 1);
  const totalHours = hours * days;
  const guardPay = totalHours * (job.number_of_guards || 1) * (job.hourly_rate || 0);
  const serviceFee = guardPay * 0.15;
  const vat = (guardPay + serviceFee) * 0.2;
  const total = guardPay + serviceFee + vat;

  const riskLevelColors: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
    high: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25' },
    urgent: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25' },
  };
  const risk = riskLevelColors[job.risk_level || 'low'] || riskLevelColors.low;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-xl bg-[#111d35] h-full overflow-y-auto border-l border-[#1e2d4d] shadow-2xl">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate max-w-xs">{job.job_title}</h2>
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${risk.bg} ${risk.text} ${risk.border}`}>
                {(job.risk_level || 'low').replace(/^\w/, (c: string) => c.toUpperCase())}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Job Details</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Cancellation Banner */}
          {isCancelled && cancellation && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-red-500/15 rounded-xl shrink-0">
                <i className="ri-close-circle-line text-red-400 text-xl"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-400">This job has been cancelled</p>
                <p className="text-xs text-red-400/80">Reason: {cancellation.reason || 'Not specified'}</p>
                <p className="text-xs text-red-400/80">Date: {formatDateTime(cancellation.cancelled_at || cancellation.created_at)}</p>
                {refundRequests.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {refundRequests.map((r) => (
                      <span key={r.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        r.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' :
                        r.status === 'approved' || r.status === 'processed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                        r.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/25'
                      }`}>
                        Refund: {r.status}
                      </span>
                    ))}
                  </div>
                )}
                {refundRequests.length === 0 && (
                  <Link href={`/client/support?new=refund_request&job=${job.id}`}>
                    <button className="mt-2 px-3 py-1.5 bg-violet-500 text-white rounded-lg text-xs font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-refund-line mr-1"></i>Request Refund
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Review Banner */}
          {isCompleted && unreviewedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 rounded-xl shrink-0">
                <i className="ri-star-line text-amber-400 text-xl"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-400">{unreviewedCount} guard{unreviewedCount !== 1 ? 's' : ''} awaiting review</p>
                <p className="text-xs text-amber-400/80">Your feedback helps improve our guard matching.</p>
              </div>
              <Link href={`/client/jobs/${job.id}`}>
                <button className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap">
                  Review
                </button>
              </Link>
            </div>
          )}

          {isCompleted && unreviewedCount === 0 && assignments.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-center gap-3">
              <i className="ri-check-double-line text-emerald-500 text-xl"></i>
              <p className="text-sm font-semibold text-emerald-400">All guards reviewed</p>
            </div>
          )}

          {/* Job Summary */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-file-info-line text-teal-400"></i>Job Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-slate-200 font-semibold capitalize">{job.status?.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Location</span><span className="text-slate-200 text-right">{job.venue_name || job.venue_city}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Address</span><span className="text-slate-200 text-right">{[job.venue_address_line1, job.venue_city, job.venue_postcode].filter(Boolean).join(', ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Shift</span><span className="text-slate-200">{formatDate(job.start_date)}{job.end_date && job.end_date !== job.start_date ? ` – ${formatDate(job.end_date)}` : ''}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="text-slate-200">{job.start_time?.slice(0, 5)} – {job.end_time?.slice(0, 5)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Guards</span><span className="text-slate-200">{job.number_of_guards} needed</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Hourly Rate</span><span className="text-teal-400 font-bold">£{job.hourly_rate}/hr</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Posted</span><span className="text-slate-200">{formatDate(job.created_at)}</span></div>
            </div>
          </div>

          {/* Pay Summary */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-money-pound-circle-line text-teal-400"></i>Pay Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total Hours</span><span className="text-slate-200">{totalHours.toFixed(1)}h</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Guard Pay</span><span className="text-slate-200">£{guardPay.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Service Fee</span><span className="text-slate-200">£{serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">VAT (20%)</span><span className="text-slate-200">£{vat.toFixed(2)}</span></div>
              <div className="flex justify-between pt-2 border-t border-[#1e2d4d]"><span className="text-white font-semibold">Total</span><span className="text-teal-400 font-bold">£{total.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Applicants Summary */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-user-received-line text-teal-400"></i>Applicants
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-200">{job.applications_count || 0}</p>
                <p className="text-xs text-slate-500">Total Applicants</p>
              </div>
              <div className="w-px h-10 bg-[#1e2d4d]"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{job.assigned_count || 0}</p>
                <p className="text-xs text-slate-500">Selected</p>
              </div>
              <div className="w-px h-10 bg-[#1e2d4d]"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{Math.max(0, (job.number_of_guards || 1) - (job.assigned_count || 0))}</p>
                <p className="text-xs text-slate-500">Still Needed</p>
              </div>
            </div>
            {job.status === 'awaiting_guard_selection' && (job.applications_count || 0) > 0 && (
              <Link href={`/client/jobs/${job.id}/select-guards`}>
                <button className="w-full mt-3 bg-teal-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-user-search-line mr-1"></i>Review Applicants
                </button>
              </Link>
            )}
          </div>

          {/* Selected Guards */}
          {assignments.length > 0 && (
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="ri-shield-user-line text-teal-400"></i>Selected Guards
              </h3>
              <div className="space-y-3">
                {assignments.map((a) => {
                  const g = a.guards;
                  const initials = g?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '??';
                  const review = guardReviews[g?.id];
                  const attendanceStatus = a.attendance_status || 'awaiting_confirmation';
                  const statusCfg: Record<string, { label: string; color: string; icon: string }> = {
                    awaiting_confirmation: { label: 'Awaiting', color: 'text-slate-400', icon: 'ri-time-line' },
                    confirmed: { label: 'Confirmed', color: 'text-blue-400', icon: 'ri-check-line' },
                    not_checked_in: { label: 'Not Checked In', color: 'text-orange-400', icon: 'ri-login-circle-line' },
                    checked_in: { label: 'Checked In', color: 'text-emerald-400', icon: 'ri-login-box-line' },
                    late: { label: 'Late', color: 'text-amber-400', icon: 'ri-time-line' },
                    no_show: { label: 'No-Show', color: 'text-red-400', icon: 'ri-user-unfollow-line' },
                    checked_out: { label: 'Checked Out', color: 'text-violet-400', icon: 'ri-logout-box-line' },
                    completed: { label: 'Completed', color: 'text-teal-400', icon: 'ri-checkbox-circle-line' },
                  };
                  const cfg = statusCfg[attendanceStatus] || statusCfg.awaiting_confirmation;
                  return (
                    <div key={a.id} className={`flex items-center gap-3 p-3 bg-[#111d35] rounded-lg border ${a.issue_reported ? 'border-red-500/40' : 'border-[#1e2d4d]'}`}>
                      <div className="w-10 h-10 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                        {g?.profile_photo_url ? (
                          <img src={g.profile_photo_url} alt={initials} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-teal-400 font-bold text-xs">{initials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{g?.full_name || 'Unknown Guard'}</p>
                        {g?.sia_licence_number && (
                          <p className="text-xs text-slate-500"><i className="ri-shield-check-line text-emerald-400 mr-1"></i>SIA: {g.sia_licence_number}</p>
                        )}
                        {g?.average_rating && g.average_rating > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-amber-400 font-bold">{g.average_rating.toFixed(1)}</span>
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map((s) => (
                                <span key={s} className={`text-xs ${s <= Math.round(g.average_rating) ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
                              ))}
                            </div>
                            <span className="text-xs text-slate-500">({g.total_reviews || 0})</span>
                          </div>
                        )}
                        {isCompleted && (
                          <div className="mt-1">
                            <ReviewStatusBadge
                              status={review ? review.review_status || 'reviewed' : 'awaiting_review'}
                              rating={review?.rating}
                              issueReported={review?.issue_reported}
                              compact
                            />
                          </div>
                        )}
                        {/* Attendance Status */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                            <i className={cfg.icon}></i>
                            {cfg.label}
                          </span>
                          {a.late_minutes > 0 && (
                            <span className="text-[10px] text-amber-400">{a.late_minutes}m late</span>
                          )}
                          {a.issue_reported && (
                            <span className="text-[10px] text-red-400 font-semibold">Issue reported</span>
                          )}
                        </div>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {a.status === 'confirmed' ? 'Confirmed' : 'Assigned'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Link href={`/client/jobs/${job.id}`}>
                <button className="w-full mt-3 bg-[#162036] text-slate-300 py-2 rounded-lg text-sm font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-user-settings-line mr-1"></i>Manage Selected Guards
                </button>
              </Link>
            </div>
          )}

          {/* Payment Status */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-secure-payment-line text-teal-400"></i>Payment Status
            </h3>
            {latestTransaction ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-semibold capitalize" style={{ color: latestTransaction.status === 'completed' ? '#34d399' : latestTransaction.status === 'failed' ? '#f87171' : '#fbbf24' }}>{latestTransaction.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="text-slate-200">£{latestTransaction.amount}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-200">{formatDateTime(latestTransaction.created_at)}</span></div>
                {latestTransaction.payment_method && (
                  <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="text-slate-200 capitalize">{latestTransaction.payment_method}</span></div>
                )}
                {latestTransaction.status === 'failed' && (
                  <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3 mt-2">
                    <p className="text-sm text-red-400 font-semibold">Payment Failed</p>
                    <p className="text-xs text-red-400/80 mt-1">{latestTransaction.failure_reason || 'Your payment could not be processed.'}</p>
                    <Link href={`/client/jobs/${job.id}/payment`}>
                      <button className="mt-2 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-refresh-line mr-1"></i>Retry Payment
                      </button>
                    </Link>
                  </div>
                )}
                {latestTransaction.status === 'pending' && (
                  <Link href={`/client/jobs/${job.id}/payment`}>
                    <button className="w-full mt-2 bg-orange-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-secure-payment-line mr-1"></i>Pay Now
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No payment recorded yet</p>
                {job.status === 'awaiting_payment' && (
                  <Link href={`/client/jobs/${job.id}/payment`}>
                    <button className="mt-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-secure-payment-line mr-1"></i>Pay Now
                    </button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {job.job_description && (
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="ri-align-left text-teal-400"></i>Description
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{job.job_description}</p>
            </div>
          )}

          {/* Special Instructions */}
          {job.special_instructions && (
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="ri-alert-line text-amber-400"></i>Special Instructions
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{job.special_instructions}</p>
            </div>
          )}

          {/* Actions */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-tools-line text-teal-400"></i>Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/client/jobs/${job.id}`}>
                <button className="w-full bg-[#111d35] text-slate-300 py-2.5 rounded-lg text-sm font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-eye-line mr-1"></i>Full Details
                </button>
              </Link>
              <Link href={`/client/messages`}>
                <button className="w-full bg-[#111d35] text-teal-400 py-2.5 rounded-lg text-sm font-semibold border border-[#1e2d4d] hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-message-3-line mr-1"></i>Message
                </button>
              </Link>
              <Link href={`/client/jobs/${job.id}/payment`}>
                <button className="w-full bg-[#111d35] text-orange-400 py-2.5 rounded-lg text-sm font-semibold border border-[#1e2d4d] hover:bg-orange-500/10 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-secure-payment-line mr-1"></i>Payment
                </button>
              </Link>
              <Link href={`/client/jobs/tracker`}>
                <button className="w-full bg-[#111d35] text-slate-300 py-2.5 rounded-lg text-sm font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-radar-line mr-1"></i>Tracker
                </button>
              </Link>
            </div>
          </div>

          {/* Incident Report */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-flashlight-line text-red-400"></i>Report Incident
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => router.push(`/client/support?new=guard_no_show&job=${job.id}`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-user-unfollow-line"></i>Guard No-Show
              </button>
              <button
                onClick={() => router.push(`/client/support?new=late_arrival&job=${job.id}`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-500/25 text-orange-400 text-xs font-semibold hover:bg-orange-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-time-line"></i>Late Arrival
              </button>
              <button
                onClick={() => router.push(`/client/support?new=poor_performance&job=${job.id}`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/25 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-emotion-unhappy-line"></i>Poor Performance
              </button>
              <button
                onClick={() => router.push(`/client/support?new=refund_request&job=${job.id}`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/25 text-violet-400 text-xs font-semibold hover:bg-violet-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refund-line"></i>Request Refund
              </button>
            </div>
            <button
              onClick={() => router.push(`/client/support?new=general_support&job=${job.id}`)}
              className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-teal-500/25 text-teal-400 text-xs font-semibold hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-customer-service-2-line"></i>Contact Support About This Job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}