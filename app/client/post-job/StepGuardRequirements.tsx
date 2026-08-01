'use client';

interface FormData {
  siaLicenceRequired: string;
  specificLicences: string[];
  experienceLevel: string;
  uniformRequired: string;
  uniformDetails: string;
  drivingRequired: string;
  dressCode: string;
  specialInstructions: string;
  additionalRequirements: string;
}

interface StepGuardRequirementsProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onCheckboxChange: (licence: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const licenceOptions = [
  'Door Supervisor',
  'Security Guard',
  'CCTV Operator',
  'Close Protection',
  'Cash & Valuables in Transit',
  'Key Holding',
  'Dog Handler',
];

export default function StepGuardRequirements({ formData, errors, onChange, onCheckboxChange, onNext, onBack }: StepGuardRequirementsProps) {
  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center font-bold">4</div>
        <div>
          <h2 className="text-xl font-bold text-white">Guard Requirements</h2>
          <p className="text-sm text-slate-500">Qualifications and expectations for guards</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">SIA Licence Required *</label>
          <div className="flex gap-6">
            {['yes', 'no'].map(val => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="siaLicenceRequired"
                  value={val}
                  checked={formData.siaLicenceRequired === val}
                  onChange={onChange}
                  className="w-4 h-4 text-teal-500 accent-teal-500"
                />
                <span className="text-slate-300 capitalize">{val}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.siaLicenceRequired === 'yes' && (
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">Specific SIA Licence Types</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {licenceOptions.map(licence => (
                <label key={licence} className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-[#1e2d4d] hover:border-teal-500/30 transition-colors bg-[#162036]">
                  <input
                    type="checkbox"
                    checked={formData.specificLicences.includes(licence)}
                    onChange={() => onCheckboxChange(licence)}
                    className="w-4 h-4 text-teal-500 accent-teal-500 rounded"
                  />
                  <span className="text-slate-300 text-sm">{licence}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Experience Required *</label>
          <div className="relative">
            <select
              name="experienceLevel"
              value={formData.experienceLevel}
              onChange={onChange}
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm pr-8 appearance-none"
            >
              <option value="">Select experience level</option>
              <option value="entry">Entry Level (0–1 years)</option>
              <option value="intermediate">Intermediate (1–3 years)</option>
              <option value="experienced">Experienced (3–5 years)</option>
              <option value="senior">Senior (5+ years)</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
          {errors.experienceLevel && <p className="text-red-400 text-sm mt-1">{errors.experienceLevel}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Uniform Requirements</label>
          <div className="flex gap-6 mb-3">
            {['yes', 'no'].map(val => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="uniformRequired"
                  value={val}
                  checked={formData.uniformRequired === val}
                  onChange={onChange}
                  className="w-4 h-4 text-teal-500 accent-teal-500"
                />
                <span className="text-slate-300 capitalize">{val}</span>
              </label>
            ))}
          </div>
          {formData.uniformRequired === 'yes' && (
            <input
              type="text"
              name="uniformDetails"
              value={formData.uniformDetails}
              onChange={onChange}
              placeholder="Describe uniform requirements (e.g., Black suit, white shirt, hi-vis vest provided)"
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Driving Licence Required?</label>
          <div className="flex gap-6">
            {['yes', 'no'].map(val => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="drivingRequired"
                  value={val}
                  checked={formData.drivingRequired === val}
                  onChange={onChange}
                  className="w-4 h-4 text-teal-500 accent-teal-500"
                />
                <span className="text-slate-300 capitalize">{val}</span>
              </label>
            ))}
          </div>
          {formData.drivingRequired === 'yes' && (
            <p className="text-xs text-slate-500 mt-1">Guards will be filtered for valid UK driving licence.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Dress Code</label>
          <input
            type="text"
            name="dressCode"
            value={formData.dressCode}
            onChange={onChange}
            placeholder="e.g., Smart casual, black trousers, white shirt, black shoes"
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Special Instructions (optional)
          </label>
          <textarea
            name="specialInstructions"
            value={formData.specialInstructions}
            onChange={onChange}
            maxLength={500}
            rows={3}
            placeholder="Any specific requirements: e.g., First Aid trained, bilingual, conflict management cert, must bring own radio..."
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm resize-none placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1 text-right">{formData.specialInstructions.length}/500</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Additional Requirements (optional)
          </label>
          <textarea
            name="additionalRequirements"
            value={formData.additionalRequirements}
            onChange={onChange}
            maxLength={500}
            rows={3}
            placeholder="Any other certifications, preferences, or notes..."
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm resize-none placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1 text-right">{formData.additionalRequirements.length}/500</p>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap">
          <i className="ri-arrow-left-line mr-1"></i> Back
        </button>
        <button type="button" onClick={onNext} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
          Next: Pay & Budget <i className="ri-arrow-right-line ml-1"></i>
        </button>
      </div>
    </div>
  );
}