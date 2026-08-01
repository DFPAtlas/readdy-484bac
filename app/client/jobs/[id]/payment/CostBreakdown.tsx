interface CostBreakdownProps {
  guards: number;
  hours: number;
  hourlyRate: number;
  guardFees: number;
  platformFee: number;
  platformFeePercent?: number;
  stripeFeeEstimate?: number;
  stripeFeePayer?: string;
  clientTotalCharge?: number;
  guardPayoutAmount?: number;
  quickguardNetFee?: number;
  vat?: number;
  total: number;
  paymentStatus?: string;
  jobTitle?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

export default function CostBreakdown({
  guards,
  hours,
  hourlyRate,
  guardFees,
  platformFee,
  platformFeePercent = 10,
  stripeFeeEstimate = 0,
  stripeFeePayer = 'client',
  clientTotalCharge,
  guardPayoutAmount,
  quickguardNetFee,
  vat = 0,
  total,
  paymentStatus,
  jobTitle,
  location,
  startDate,
  endDate,
  startTime,
  endTime,
}: CostBreakdownProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const showStripeFee = stripeFeeEstimate > 0;
  const displayTotal = clientTotalCharge ?? total;

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 p-4 border-b border-[#1e2d4d]">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="ri-calculator-line text-teal-400"></i>
          Payment Summary
        </h3>
      </div>

      <div className="p-6 space-y-4">
        {jobTitle && (
          <div className="pb-4 border-b border-[#1e2d4d] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Job</span>
              <span className="text-sm font-semibold text-slate-200 text-right">{jobTitle}</span>
            </div>
            {location && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Location</span>
                <span className="text-sm font-semibold text-slate-200 text-right">{location}</span>
              </div>
            )}
            {(startDate || endDate) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Date</span>
                <span className="text-sm font-semibold text-slate-200 text-right">
                  {formatDate(startDate)}{endDate && endDate !== startDate ? ` - ${formatDate(endDate)}` : ""}
                </span>
              </div>
            )}
            {(startTime || endTime) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Time</span>
                <span className="text-sm font-semibold text-slate-200 text-right">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Guards</span>
              <span className="text-sm font-semibold text-slate-200">{guards}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Total Hours</span>
              <span className="text-sm font-semibold text-slate-200">{hours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Hourly Rate</span>
              <span className="text-sm font-semibold text-slate-200">£{hourlyRate.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Guard Fees</span>
            <span className="font-semibold text-slate-200">£{guardFees.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Platform Fee</span>
              <span className="text-xs text-slate-500">({platformFeePercent}%)</span>
            </div>
            <span className="font-semibold text-slate-200">£{platformFee.toFixed(2)}</span>
          </div>
          {showStripeFee && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">Stripe Processing Fee</span>
                <span className="text-xs text-slate-500">({stripeFeePayer === 'client' ? 'paid by you' : stripeFeePayer === 'guard' ? 'paid by guard' : stripeFeePayer === 'split' ? 'split' : 'included'})</span>
              </div>
              <span className={`font-semibold ${stripeFeePayer === 'client' ? 'text-amber-400' : 'text-slate-500'}`}>£{stripeFeeEstimate.toFixed(2)}</span>
            </div>
          )}
          {guardPayoutAmount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Guard receives</span>
              <span className="font-semibold text-emerald-400">£{guardPayoutAmount.toFixed(2)}</span>
            </div>
          )}
          {quickguardNetFee !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">QuickGuard net fee</span>
              <span className="font-semibold text-blue-400">£{quickguardNetFee.toFixed(2)}</span>
            </div>
          )}
          {vat > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">VAT</span>
                <span className="text-xs text-slate-500">(20%)</span>
              </div>
              <span className="font-semibold text-slate-200">£{vat.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="border-t-2 border-teal-500 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-white">Total Payable</span>
            <span className="text-2xl font-bold text-teal-400">£{displayTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-emerald-500/10 rounded-lg p-3 mt-4 border border-emerald-500/25">
          <div className="flex items-start gap-2">
            <i className="ri-shield-check-line text-emerald-400 mt-0.5"></i>
            <div>
              <p className="text-sm font-medium text-emerald-400">Price Guarantee</p>
              <p className="text-xs text-emerald-500 mt-0.5">No hidden fees. This is your final amount.</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/25">
          <div className="flex items-start gap-2">
            <i className="ri-government-line text-amber-400 mt-0.5"></i>
            <div>
              <p className="text-sm font-medium text-amber-400">Tax Responsibility</p>
              <p className="text-xs text-amber-500 mt-0.5">You are responsible for your own tax, VAT, and legal reporting. QuickGuard does not deduct or pay tax on your behalf.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}