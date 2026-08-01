'use client';

import { useState } from 'react';

interface RepeatOption {
  value: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  activeBorder: string;
  activeBg: string;
}

const repeatOptions: RepeatOption[] = [
  { value: 'none', label: 'One-off', sub: 'Single shift', icon: 'ri-calendar-event-line', color: 'text-slate-500', activeBorder: 'border-slate-500', activeBg: 'bg-slate-500/10' },
  { value: 'daily', label: 'Daily', sub: 'Every day', icon: 'ri-calendar-check-line', color: 'text-blue-400', activeBorder: 'border-blue-500', activeBg: 'bg-blue-500/10' },
  { value: 'weekdays', label: 'Weekdays', sub: 'Mon–Fri', icon: 'ri-calendar-2-line', color: 'text-indigo-400', activeBorder: 'border-indigo-500', activeBg: 'bg-indigo-500/10' },
  { value: 'weekends', label: 'Weekends', sub: 'Sat–Sun', icon: 'ri-calendar-line', color: 'text-violet-400', activeBorder: 'border-violet-500', activeBg: 'bg-violet-500/10' },
  { value: 'weekly', label: 'Weekly', sub: 'Same day weekly', icon: 'ri-repeat-line', color: 'text-teal-400', activeBorder: 'border-teal-500', activeBg: 'bg-teal-500/10' },
  { value: 'custom', label: 'Custom', sub: 'Set your own', icon: 'ri-settings-3-line', color: 'text-amber-400', activeBorder: 'border-amber-500', activeBg: 'bg-amber-500/10' },
];

interface FormData {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  breakInfo: string;
  repeatShift: string;
  repeatFrequency: string;
  repeatEndDate: string;
  numberOfDays: string;
}

interface StepShiftDatesProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepShiftDates({ formData, errors, onChange, onNext, onBack }: StepShiftDatesProps) {
  const [sh, sm] = formData.startTime?.split(':').map(Number) || [0, 0];
  const [eh, em] = formData.endTime?.split(':').map(Number) || [0, 0];
  let hours = (eh * 60 + em - sh * 60 - sm) / 60;
  if (hours <= 0) hours += 24;

  const selectedRepeat = repeatOptions.find(r => r.value === formData.repeatShift) || repeatOptions[0];

  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center font-bold">3</div>
        <div>
          <h2 className="text-xl font-bold text-white">Shift Dates & Times</h2>
          <p className="text-sm text-slate-500">When the security cover is needed</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Start Date *</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={onChange}
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm"
            />
            {errors.startDate && <p className="text-red-400 text-sm mt-1">{errors.startDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">End Date *</label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={onChange}
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm"
            />
            {errors.endDate && <p className="text-red-400 text-sm mt-1">{errors.endDate}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Start Time *</label>
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={onChange}
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm"
            />
            {errors.startTime && <p className="text-red-400 text-sm mt-1">{errors.startTime}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Finish Time *</label>
            <input
              type="time"
              name="endTime"
              value={formData.endTime}
              onChange={onChange}
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm"
            />
            {errors.endTime && <p className="text-red-400 text-sm mt-1">{errors.endTime}</p>}
          </div>
        </div>

        {formData.startTime && formData.endTime && (
          <div className="bg-[#162036] rounded-xl p-3 border border-[#1e2d4d] flex items-center gap-3">
            <i className="ri-time-line text-teal-400 text-lg"></i>
            <span className="text-sm text-slate-300">
              Estimated shift length: <span className="font-bold text-white">{hours.toFixed(1)} hours</span>
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Number of Days</label>
          <div className="relative">
            <select
              name="numberOfDays"
              value={formData.numberOfDays}
              onChange={onChange}
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm pr-8 appearance-none"
            >
              <option value="1">1 Day</option>
              <option value="2">2 Days</option>
              <option value="3">3 Days</option>
              <option value="4">4 Days</option>
              <option value="5">5 Days</option>
              <option value="6">6 Days</option>
              <option value="7">7 Days (1 Week)</option>
              <option value="14">14 Days (2 Weeks)</option>
              <option value="21">21 Days (3 Weeks)</option>
              <option value="30">30 Days (1 Month)</option>
              <option value="60">60 Days (2 Months)</option>
              <option value="90">90 Days (3 Months)</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Break Information (optional)</label>
          <input
            type="text"
            name="breakInfo"
            value={formData.breakInfo}
            onChange={onChange}
            placeholder="e.g., 30 min unpaid break after 4 hours, 1 hour paid lunch"
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">Repeat Pattern</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {repeatOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ target: { name: 'repeatShift', value: opt.value } } as any)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                  formData.repeatShift === opt.value
                    ? `${opt.activeBorder} ${opt.activeBg}`
                    : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.repeatShift === opt.value ? opt.activeBg.replace('/10', '/20') : 'bg-[#111d35]'}`}>
                  <i className={`${opt.icon} ${formData.repeatShift === opt.value ? opt.color : 'text-slate-500'}`}></i>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${formData.repeatShift === opt.value ? 'text-white' : 'text-slate-400'}`}>{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {formData.repeatShift !== 'none' && formData.repeatShift !== 'custom' && (
            <div className="mt-4 bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
              <p className="text-sm text-slate-300 flex items-center gap-2">
                <i className="ri-information-line text-teal-400"></i>
                <span>
                  Guards will see this as a <span className="font-semibold text-white">{selectedRepeat.label.toLowerCase()}</span> pattern.
                  They can apply once and cover all recurring shifts.
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                <i className="ri-alert-line text-amber-400 mr-1"></i>
                Recurring jobs are posted as one-off for now. Full recurring automation is coming soon.
              </p>
            </div>
          )}

          {formData.repeatShift === 'custom' && (
            <div className="mt-4 bg-[#162036] rounded-xl p-4 border border-[#1e2d4d] space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Custom Frequency</label>
                <input
                  type="text"
                  name="repeatFrequency"
                  value={formData.repeatFrequency || ''}
                  onChange={onChange}
                  placeholder="e.g., Every Tuesday and Thursday, or Every other Monday"
                  className="w-full px-4 py-3 bg-[#111d35] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Repeat Until (optional)</label>
                <input
                  type="date"
                  name="repeatEndDate"
                  value={formData.repeatEndDate || ''}
                  onChange={onChange}
                  className="w-full px-4 py-3 bg-[#111d35] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm"
                />
              </div>
              <p className="text-xs text-slate-500">
                <i className="ri-alert-line text-amber-400 mr-1"></i>
                Custom recurring patterns are saved as one-off jobs for now. Full recurring automation is coming soon.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap">
          <i className="ri-arrow-left-line mr-1"></i> Back
        </button>
        <button type="button" onClick={onNext} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
          Next: Guard Requirements <i className="ri-arrow-right-line ml-1"></i>
        </button>
      </div>
    </div>
  );
}