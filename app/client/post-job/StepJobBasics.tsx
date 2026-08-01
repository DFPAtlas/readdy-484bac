'use client';

interface FormData {
  isFeatured: boolean;
  isUrgent: boolean;
  featuredDuration: string;
  urgency: string;
  jobTitle: string;
  securityType: string;
  numberOfGuards: string;
  jobDescription: string;
}

interface StepJobBasicsProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onNext: () => void;
}

const securityTypes = [
  { value: 'door-supervisor', label: 'Door Supervisor' },
  { value: 'event-security', label: 'Event Security' },
  { value: 'retail-security', label: 'Retail Security' },
  { value: 'close-protection', label: 'Close Protection' },
  { value: 'cctv-operator', label: 'CCTV Operator' },
  { value: 'security-guard', label: 'Security Guard' },
  { value: 'mobile-patrol', label: 'Mobile Patrol' },
  { value: 'key-holding', label: 'Key Holding' },
  { value: 'dog-handler', label: 'Dog Handler' },
];

export default function StepJobBasics({ formData, errors, onChange, onNext }: StepJobBasicsProps) {
  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center font-bold">1</div>
        <div>
          <h2 className="text-xl font-bold text-white">Job Basics</h2>
          <p className="text-sm text-slate-500">Core details about the security role</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Job Title *</label>
          <input
            type="text"
            name="jobTitle"
            value={formData.jobTitle}
            onChange={onChange}
            placeholder="e.g., Door Supervisor for Nightclub Event"
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
          />
          {errors.jobTitle && <p className="text-red-400 text-sm mt-1">{errors.jobTitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Job Type *</label>
            <div className="relative">
              <select
                name="securityType"
                value={formData.securityType}
                onChange={onChange}
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm pr-8 appearance-none"
              >
                <option value="">Select job type</option>
                {securityTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
            </div>
            {errors.securityType && <p className="text-red-400 text-sm mt-1">{errors.securityType}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Number of Guards Required *</label>
            <input
              type="number"
              name="numberOfGuards"
              value={formData.numberOfGuards}
              onChange={onChange}
              min="1"
              max="100"
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm"
            />
            {errors.numberOfGuards && <p className="text-red-400 text-sm mt-1">{errors.numberOfGuards}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Short Job Description * <span className="font-normal text-slate-500">({formData.jobDescription.length}/500)</span>
          </label>
          <textarea
            name="jobDescription"
            value={formData.jobDescription}
            onChange={onChange}
            maxLength={500}
            rows={4}
            placeholder="Briefly describe the role, key responsibilities, and what you expect from guards..."
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm resize-none placeholder:text-slate-500"
          />
          {errors.jobDescription && <p className="text-red-400 text-sm mt-1">{errors.jobDescription}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">Urgency Level</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'standard', label: 'Standard', sub: '7+ days', icon: 'ri-time-line', activeClass: 'border-emerald-500 bg-emerald-500/10', iconClass: 'text-emerald-400' },
              { value: 'urgent', label: 'Urgent', sub: '3–7 days', icon: 'ri-alarm-warning-line', activeClass: 'border-amber-500 bg-amber-500/10', iconClass: 'text-amber-400' },
              { value: 'immediate', label: 'Immediate', sub: 'Within 48hrs', icon: 'ri-flashlight-line', activeClass: 'border-red-500 bg-red-500/10', iconClass: 'text-red-400' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ target: { name: 'urgency', value: opt.value } } as any)}
                className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  formData.urgency === opt.value ? opt.activeClass : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
                }`}
              >
                <i className={`${opt.icon} text-xl ${formData.urgency === opt.value ? opt.iconClass : 'text-slate-500'}`}></i>
                <p className={`text-sm font-semibold mt-1 ${formData.urgency === opt.value ? 'text-white' : 'text-slate-400'}`}>{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#1e2d4d] pt-6">
          <label className="block text-sm font-semibold text-white mb-4">Boost Options</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onChange({ target: { name: 'isFeatured', value: !formData.isFeatured } } as any)}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                formData.isFeatured
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.isFeatured ? 'bg-violet-500/20' : 'bg-[#111d35]'}`}>
                  <i className={`ri-vip-crown-line text-lg ${formData.isFeatured ? 'text-violet-400' : 'text-slate-500'}`}></i>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${formData.isFeatured ? 'text-white' : 'text-slate-400'}`}>Featured Job</p>
                  <p className="text-xs text-slate-500">Highlight your job in the marketplace</p>
                </div>
              </div>
              {formData.isFeatured && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1">Featured Duration</label>
                  <div className="relative">
                    <select
                      name="featuredDuration"
                      value={formData.featuredDuration}
                      onChange={onChange}
                      className="w-full px-3 py-2 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-white text-xs pr-8 appearance-none"
                    >
                      <option value="3">3 days</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"></i>
                  </div>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => onChange({ target: { name: 'isUrgent', value: !formData.isUrgent } } as any)}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                formData.isUrgent
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.isUrgent ? 'bg-red-500/20' : 'bg-[#111d35]'}`}>
                  <i className={`ri-flashlight-line text-lg ${formData.isUrgent ? 'text-red-400' : 'text-slate-500'}`}></i>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${formData.isUrgent ? 'text-white' : 'text-slate-400'}`}>Mark as Urgent</p>
                  <p className="text-xs text-slate-500">Push to top of search results</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button type="button" onClick={onNext} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
          Next: Location <i className="ri-arrow-right-line ml-1"></i>
        </button>
      </div>
    </div>
  );
}