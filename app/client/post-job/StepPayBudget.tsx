'use client';

import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';

interface FormData {
  hourlyRate: string;
  startTime: string;
  endTime: string;
  numberOfGuards: string;
  numberOfDays: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

interface StepPayBudgetProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onNext: () => void;
  onBack: () => void;
  paygServiceFeePct: number;
}

export default function StepPayBudget({ formData, errors, onChange, onNext, onBack, paygServiceFeePct }: StepPayBudgetProps) {
  const [sh, sm] = formData.startTime?.split(':').map(Number) || [0, 0];
  const [eh, em] = formData.endTime?.split(':').map(Number) || [0, 0];
  let hours = (eh * 60 + em - sh * 60 - sm) / 60;
  if (hours <= 0) hours += 24;

  const hasRate = formData.hourlyRate && formData.startTime && formData.endTime;
  const fees = hasRate ? calculatePaygFees({
    hourlyRate: parseFloat(formData.hourlyRate),
    hours,
    numberOfGuards: parseInt(formData.numberOfGuards) || 1,
    numberOfDays: parseInt(formData.numberOfDays) || 1,
    serviceFeePct: paygServiceFeePct,
  }) : null;

  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center font-bold">5</div>
        <div>
          <h2 className="text-xl font-bold text-white">Pay & Budget</h2>
          <p className="text-sm text-slate-500">Set the rate and review your cost</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Hourly Rate per Guard (£) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">£</span>
              <input
                type="number"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={onChange}
                min="10"
                step="0.50"
                placeholder="e.g., 14.50"
                className="w-full pl-8 pr-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
              />
            </div>
            {errors.hourlyRate && <p className="text-red-400 text-sm mt-1">{errors.hourlyRate}</p>}
            <p className="text-xs text-slate-500 mt-1">Most UK security guards charge £12–£18/hr. Minimum is £10.00.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Estimated Hours per Shift</label>
            <div className="w-full px-4 py-3 bg-[#0e1628] border border-[#1e2d4d] rounded-xl text-sm text-slate-300">
              {formData.startTime && formData.endTime ? (
                <span className="font-semibold text-white">{hours.toFixed(1)} hours</span>
              ) : (
                <span className="text-slate-500">Enter shift times first</span>
              )}
            </div>
          </div>
        </div>

        {fees && (
          <div className="bg-[#162036] rounded-2xl p-5 border border-[#1e2d4d]">
            <h4 className="text-sm font-bold text-white mb-3">Estimated Cost Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Guard hourly rate</span>
                <span className="font-medium text-slate-200">{formatCurrency(fees.guardRate)}/hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hours per shift</span>
                <span className="font-medium text-slate-200">{fees.hours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Guards</span>
                <span className="font-medium text-slate-200">× {fees.numberOfGuards}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Days</span>
                <span className="font-medium text-slate-200">× {fees.numberOfDays}</span>
              </div>
              <div className="border-t border-[#1e2d4d] pt-2 flex justify-between">
                <span className="font-semibold text-white">Guard total</span>
                <span className="font-semibold text-white">{formatCurrency(fees.guardTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Service fee ({fees.serviceFeeLabel})</span>
                {fees.savings > 0 ? (
                  <div className="text-right">
                    <span className="line-through text-slate-600 text-xs">{formatCurrency(fees.guardTotal * (fees.serviceFeePct / 100))}</span>
                    <span className="ml-2 font-medium text-teal-400">{formatCurrency(fees.serviceFee)}</span>
                    <span className="ml-1 text-xs bg-teal-500/15 text-teal-400 px-1.5 py-0.5 rounded-full border border-teal-400/20">Promo</span>
                  </div>
                ) : (
                  <span className="font-medium text-slate-200">{formatCurrency(fees.serviceFee)}</span>
                )}
              </div>
              {fees.savings > 0 && (
                <div className="flex justify-between text-emerald-400/80 text-xs bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/15">
                  <span><i className="ri-gift-line mr-1" />Promo savings</span>
                  <span>-{formatCurrency(fees.savings)}</span>
                </div>
              )}
              <div className="border-t border-[#1e2d4d] pt-2 flex justify-between items-center">
                <span className="font-bold text-white">Total to pay</span>
                <span className="font-bold text-teal-400 text-lg">{formatCurrency(fees.total)}</span>
              </div>
              <p className="text-xs text-slate-500">Pay only when you book. Funds held with Stripe until shift is complete.</p>
            </div>
          </div>
        )}

        <div className="border-t border-[#1e2d4d] pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Your Contact Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Contact Name *</label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={onChange}
                placeholder="Your full name"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
              />
              {errors.contactName && <p className="text-red-400 text-sm mt-1">{errors.contactName}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Contact Phone *</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={onChange}
                  placeholder="07XXX XXXXXX"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
                />
                {errors.contactPhone && <p className="text-red-400 text-sm mt-1">{errors.contactPhone}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={onChange}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
                />
                {errors.contactEmail && <p className="text-red-400 text-sm mt-1">{errors.contactEmail}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap">
          <i className="ri-arrow-left-line mr-1"></i> Back
        </button>
        <button type="button" onClick={onNext} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
          Next: Review & Post <i className="ri-arrow-right-line ml-1"></i>
        </button>
      </div>
    </div>
  );
}