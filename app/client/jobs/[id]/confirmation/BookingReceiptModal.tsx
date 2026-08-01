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

interface Transaction {
  id: string;
  status: string;
  amount: number;
  created_at: string;
  completed_at: string | null;
  payment_method: string | null;
  receipt_url: string | null;
}

interface Job {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  venue_postcode: string;
  venue_address_line1: string;
  venue_address_line2: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  hourly_rate: number;
  job_description: string;
  special_instructions: string | null;
  booking_reference: string | null;
  client_confirmed_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  risk_level: string | null;
}

interface Costs {
  guardPay: number;
  serviceFee: number;
  vat: number;
  total: number;
  hours: number;
  days: number;
}

interface BookingReceiptModalProps {
  job: Job;
  assignments: Assignment[];
  transaction: Transaction | null;
  costs: Costs;
  bookingRef: string;
  confirmedAt: string;
  onClose: () => void;
}

export default function BookingReceiptModal({
  job,
  assignments,
  transaction,
  costs,
  bookingRef,
  confirmedAt,
  onClose,
}: BookingReceiptModalProps) {
  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const formatDateTime = (d: string) =>
    d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const handleDownload = () => {
    const content = `
QUICKGUARD BOOKING CONFIRMATION
=================================

Booking Reference: ${bookingRef || 'N/A'}
Confirmed: ${formatDateTime(confirmedAt)}

JOB DETAILS
-----------
Title: ${job.job_title}
Location: ${job.venue_name}, ${[job.venue_address_line1, job.venue_address_line2, job.venue_city, job.venue_postcode].filter(Boolean).join(', ')}
Date: ${formatDate(job.start_date)}${job.end_date && job.end_date !== job.start_date ? ` - ${formatDate(job.end_date)}` : ''}
Time: ${job.start_time?.slice(0, 5)} - ${job.end_time?.slice(0, 5)}
Guards Required: ${job.number_of_guards}
Hourly Rate: £${job.hourly_rate}/hr

SELECTED GUARDS
---------------
${assignments.map((a, i) => `${i + 1}. ${a.guards?.full_name || 'Unknown'}${a.guards?.sia_verified ? ' (SIA Verified)' : ''}${a.guard_confirmed_at ? ' - Guard Confirmed' : ' - Awaiting Confirmation'}`).join('\n') || 'None'}

PAYMENT SUMMARY
---------------
Guard Fees: £${costs.guardPay.toFixed(2)}
Service Fee (10%): £${costs.serviceFee.toFixed(2)}
VAT (20%): £${costs.vat.toFixed(2)}
Total: £${costs.total.toFixed(2)}

${transaction ? `Payment Status: ${transaction.status}\nPayment Method: ${transaction.payment_method || 'Card'}\nTransaction Date: ${formatDateTime(transaction.created_at)}` : 'Payment: Pending'}

SUPPORT
-------
Email: support@quickguard.uk
Phone: 0800 123 4567

Thank you for booking with QuickGuard.
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QuickGuard-Booking-${bookingRef || job.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/15 rounded-xl">
              <i className="ri-file-list-3-line text-emerald-500 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Booking Confirmation</h2>
              <p className="text-xs text-slate-500">Reference: {bookingRef || 'N/A'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-xl border border-teal-500/25 p-5 text-center">
            <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/25">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white">Booking Confirmed</h3>
            <p className="text-sm text-slate-400 mt-1">
              Confirmed on {formatDateTime(confirmedAt)}
            </p>
            <p className="text-xs font-mono text-teal-400 mt-2 bg-[#162036] inline-block px-3 py-1 rounded-full border border-[#1e2d4d]">
              {bookingRef || 'N/A'}
            </p>
          </div>

          {/* Job Details */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <i className="ri-file-info-line text-teal-400"></i>
              Job Details
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Title:</span> <span className="text-slate-200 font-semibold">{job.job_title}</span></div>
              <div><span className="text-slate-500">Location:</span> <span className="text-slate-200">{job.venue_name}</span></div>
              <div><span className="text-slate-500">Address:</span> <span className="text-slate-200">{[job.venue_address_line1, job.venue_city, job.venue_postcode].filter(Boolean).join(', ')}</span></div>
              <div><span className="text-slate-500">Date:</span> <span className="text-slate-200">{formatDate(job.start_date)}{job.end_date ? ` - ${formatDate(job.end_date)}` : ''}</span></div>
              <div><span className="text-slate-500">Time:</span> <span className="text-slate-200">{job.start_time?.slice(0, 5)} - {job.end_time?.slice(0, 5)}</span></div>
              <div><span className="text-slate-500">Guards:</span> <span className="text-slate-200">{job.number_of_guards}</span></div>
              <div><span className="text-slate-500">Rate:</span> <span className="text-slate-200">£{job.hourly_rate}/hr</span></div>
              <div><span className="text-slate-500">Risk:</span> <span className="text-slate-200 capitalize">{job.risk_level || 'low'}</span></div>
            </div>
          </div>

          {/* Selected Guards */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <i className="ri-shield-user-line text-teal-400"></i>
              Selected Guards
            </h3>
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500">No guards assigned</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a, i) => {
                  const g = a.guards;
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
                      <span className="text-xs text-slate-500 font-mono w-5">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-200">{g?.full_name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {g?.sia_verified && <span className="text-[10px] text-emerald-400">SIA Verified</span>}
                          {g?.average_rating && <span className="text-[10px] text-amber-400"><i className="ri-star-fill mr-0.5"></i>{g.average_rating.toFixed(1)}</span>}
                          {g?.phone && <span className="text-[10px] text-slate-500">{g.phone}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.guard_confirmed_at ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'}`}>
                        {a.guard_confirmed_at ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <i className="ri-money-pound-circle-line text-teal-400"></i>
              Payment Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Guard Fees</span><span className="text-slate-200 font-semibold">£{costs.guardPay.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Service Fee</span><span className="text-slate-200 font-semibold">£{costs.serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">VAT</span><span className="text-slate-200 font-semibold">£{costs.vat.toFixed(2)}</span></div>
              <div className="border-t border-[#1e2d4d] pt-2 flex justify-between">
                <span className="text-white font-semibold">Total</span>
                <span className="text-teal-400 font-bold">£{costs.total.toFixed(2)}</span>
              </div>
            </div>
            {transaction && (
              <div className="mt-3 pt-3 border-t border-[#1e2d4d] text-xs text-slate-500">
                <p>Payment: {transaction.status} · {transaction.payment_method || 'Card'} · {formatDateTime(transaction.created_at)}</p>
              </div>
            )}
          </div>

          {/* Support */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
              <i className="ri-customer-service-2-line text-teal-400"></i>
              Support Contact
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-teal-400 font-semibold">support@quickguard.uk</p>
              </div>
              <div className="p-3 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-teal-400 font-semibold">0800 123 4567</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#111d35] border-t border-[#1e2d4d] px-6 py-4 flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-download-line"></i>
            Download Confirmation
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}