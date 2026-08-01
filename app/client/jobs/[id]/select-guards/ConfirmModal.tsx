'use client';

interface Guard {
  id: string;
  full_name: string;
  hourly_rate: number | null;
  rating: number | null;
  sia_verified: boolean;
  profile_photo_url: string | null;
}

interface Job {
  job_title: string;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  number_of_guards: number;
  venue_name: string;
}

interface ConfirmModalProps {
  selectedGuards: Guard[];
  job: Job;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

export default function ConfirmModal({ selectedGuards, job, onClose, onConfirm, confirming }: ConfirmModalProps) {
  const startH = parseInt(job.start_time.split(':')[0]);
  const startM = parseInt(job.start_time.split(':')[1]);
  const endH = parseInt(job.end_time.split(':')[0]);
  const endM = parseInt(job.end_time.split(':')[1]);
  let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const hoursPerShift = totalMinutes / 60;

  const startDate = new Date(job.start_date);
  const endDate = job.end_date ? new Date(job.end_date) : startDate;
  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const guardFees = selectedGuards.reduce((sum, g) => sum + (g.hourly_rate || job.hourly_rate) * hoursPerShift * daysDiff, 0);
  const serviceFee = guardFees * 0.1;
  const vat = (guardFees + serviceFee) * 0.2;
  const total = guardFees + serviceFee + vat;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-[#1e2d4d]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Confirm Guard Selection</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer">
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-[#162036] rounded-xl p-4 mb-6 border border-[#1e2d4d]">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">{job.job_title}</h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span><i className="ri-map-pin-line mr-1"></i>{job.venue_name}</span>
              <span><i className="ri-calendar-line mr-1"></i>{new Date(job.start_date).toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Selected Guards ({selectedGuards.length}/{job.number_of_guards})
          </h3>
          <div className="space-y-3 mb-6">
            {selectedGuards.map((guard) => (
              <div key={guard.id} className="flex items-center gap-3 bg-[#162036] border border-[#1e2d4d] rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-[#111d35] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#1e2d4d]">
                  {guard.profile_photo_url ? (
                    <img src={guard.profile_photo_url} alt={guard.full_name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <i className="ri-user-line text-slate-500"></i>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{guard.full_name}</p>
                  <div className="flex items-center gap-2">
                    {guard.sia_verified && (
                      <span className="text-xs text-emerald-400"><i className="ri-verified-badge-fill mr-0.5"></i>SIA</span>
                    )}
                    {guard.rating && (
                      <span className="text-xs text-slate-500"><i className="ri-star-fill text-amber-400 mr-0.5"></i>{guard.rating.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-teal-400">£{guard.hourly_rate || job.hourly_rate}/hr</p>
              </div>
            ))}
          </div>

          <div className="bg-[#162036] rounded-xl p-4 mb-6 border border-[#1e2d4d]">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Cost Estimate</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Guard fees ({selectedGuards.length} guards × {hoursPerShift.toFixed(1)}hrs × {daysDiff} day{daysDiff > 1 ? 's' : ''})</span>
                <span>£{guardFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>QuickGuard service fee (10%)</span>
                <span>£{serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT (20%)</span>
                <span>£{vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-[#1e2d4d]">
                <span>Estimated Total</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-6">
            <i className="ri-information-line mr-1"></i>
            By confirming, selected guards will be notified and assigned to this job. Payment will be processed upon job completion.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-xl hover:bg-[#1a2642] transition-colors font-medium cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl hover:bg-teal-600 transition-colors font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Confirming...
                </span>
              ) : (
                <>
                  <i className="ri-check-double-line mr-1.5"></i>
                  Confirm Selection
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
