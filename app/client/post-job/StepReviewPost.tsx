'use client';

import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';
import JobScheduler from './JobScheduler';

interface StepReviewPostProps {
  formData: any;
  onPost: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onSaveTemplate: () => void;
  draftSaveStatus: 'idle' | 'saving' | 'saved';
  submitting: boolean;
  submitStatus: 'idle' | 'submitting' | 'success' | 'error';
  errors: Record<string, string>;
  paygServiceFeePct: number;
  onFieldChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const securityTypeLabels: Record<string, string> = {
  'door-supervisor': 'Door Supervisor',
  'event-security': 'Event Security',
  'retail-security': 'Retail Security',
  'close-protection': 'Close Protection',
  'cctv-operator': 'CCTV Operator',
  'security-guard': 'Security Guard',
  'mobile-patrol': 'Mobile Patrol',
  'key-holding': 'Key Holding',
  'dog-handler': 'Dog Handler',
};

const experienceLabels: Record<string, string> = {
  entry: 'Entry Level (0–1 years)',
  intermediate: 'Intermediate (1–3 years)',
  experienced: 'Experienced (3–5 years)',
  senior: 'Senior (5+ years)',
};

const urgencyLabels: Record<string, string> = {
  standard: 'Standard (7+ days)',
  urgent: 'Urgent (3–7 days)',
  immediate: 'Immediate (Within 48hrs)',
};

const repeatLabels: Record<string, string> = {
  none: 'No repeat — one-off shift',
  daily: 'Repeat daily',
  weekdays: 'Repeat on weekdays (Mon–Fri)',
  weekends: 'Repeat on weekends (Sat–Sun)',
  weekly: 'Repeat weekly',
  custom: 'Custom pattern',
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value || value === '') return null;
  return (
    <div className="flex justify-between py-2 border-b border-[#1e2d4d]">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
        <i className={`${icon} text-teal-400`}></i>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function StepReviewPost({
  formData,
  onPost,
  onBack,
  onSaveDraft,
  onSaveTemplate,
  draftSaveStatus,
  submitting,
  submitStatus,
  errors,
  paygServiceFeePct,
  onFieldChange,
}: StepReviewPostProps) {
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

  const isScheduled = !!formData.publishAt && new Date(formData.publishAt) > new Date();

  return (
    <div className="space-y-6">
      {onFieldChange && (
        <JobScheduler
          publishAt={formData.publishAt || ''}
          expiresAt={formData.expiresAt || ''}
          autoCloseOnExpiry={formData.autoCloseOnExpiry !== false}
          onChange={onFieldChange}
        />
      )}
      <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center font-bold">6</div>
          <div>
            <h2 className="text-xl font-bold text-white">Review & Post</h2>
            <p className="text-sm text-slate-500">Double-check everything before posting</p>
          </div>
        </div>

        <div className="space-y-5">
          <Section title="Job Basics" icon="ri-briefcase-line">
            <InfoRow label="Job Title" value={formData.jobTitle} />
            <InfoRow label="Job Type" value={securityTypeLabels[formData.securityType] || formData.securityType} />
            <InfoRow label="Guards Needed" value={formData.numberOfGuards} />
            <InfoRow label="Urgency" value={urgencyLabels[formData.urgency] || formData.urgency} />
            <InfoRow label="Description" value={formData.jobDescription} />
            {formData.isFeatured && (
              <div className="flex justify-between py-2 border-b border-[#1e2d4d]">
                <span className="text-sm text-slate-400">Featured</span>
                <span className="text-sm font-semibold text-violet-400 flex items-center gap-1">
                  <i className="ri-vip-crown-line"></i>Featured for {formData.featuredDuration} days
                </span>
              </div>
            )}
            {formData.isUrgent && (
              <div className="flex justify-between py-2 border-b border-[#1e2d4d]">
                <span className="text-sm text-slate-400">Priority</span>
                <span className="text-sm font-semibold text-red-400 flex items-center gap-1">
                  <i className="ri-flashlight-line"></i>Urgent
                </span>
              </div>
            )}
          </Section>

          <Section title="Location & Site" icon="ri-map-pin-line">
            <InfoRow label="Site Name" value={formData.venue} />
            <InfoRow label="Address" value={[formData.addressLine1, formData.addressLine2].filter(Boolean).join(', ')} />
            <InfoRow label="City" value={formData.city} />
            <InfoRow label="Postcode" value={formData.postcode} />
            <InfoRow label="Site Contact" value={formData.siteContactName ? `${formData.siteContactName}${formData.siteContactPhone ? ' — ' + formData.siteContactPhone : ''}` : undefined} />
            <InfoRow label="Site Instructions" value={formData.siteInstructions} />
          </Section>

          <Section title="Shift Dates & Times" icon="ri-calendar-schedule-line">
            <InfoRow label="Start Date" value={formData.startDate ? new Date(formData.startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''} />
            <InfoRow label="End Date" value={formData.endDate ? new Date(formData.endDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''} />
            <InfoRow label="Duration" value={formData.numberOfDays ? `${formData.numberOfDays} day${parseInt(formData.numberOfDays) > 1 ? 's' : ''}` : ''} />
            <InfoRow label="Hours" value={formData.startTime && formData.endTime ? `${formData.startTime} – ${formData.endTime}` : ''} />
            <InfoRow label="Break Info" value={formData.breakInfo} />
            <InfoRow label="Repeat Pattern" value={repeatLabels[formData.repeatShift] || formData.repeatShift} />
          </Section>

          <Section title="Guard Requirements" icon="ri-shield-check-line">
            <InfoRow label="SIA Licence" value={formData.siaLicenceRequired === 'yes' ? 'Required' : 'Not Required'} />
            {formData.specificLicences?.length > 0 && (
              <InfoRow label="Licence Types" value={formData.specificLicences.join(', ')} />
            )}
            <InfoRow label="Experience" value={experienceLabels[formData.experienceLevel] || formData.experienceLevel} />
            <InfoRow label="Uniform" value={formData.uniformRequired === 'yes' ? (formData.uniformDetails || 'Required') : 'Not Required'} />
            <InfoRow label="Driving" value={formData.drivingRequired === 'yes' ? 'Required' : 'Not Required'} />
            <InfoRow label="Dress Code" value={formData.dressCode} />
            <InfoRow label="Special Instructions" value={formData.specialInstructions} />
            <InfoRow label="Additional Requirements" value={formData.additionalRequirements} />
          </Section>

          <Section title="Payment & Contact" icon="ri-money-pound-circle-line">
            <InfoRow label="Hourly Rate" value={formData.hourlyRate ? `£${formData.hourlyRate}/hr` : ''} />
            {fees && (
              <>
                <InfoRow label="Hours per Shift" value={`${fees.hours}h`} />
                <InfoRow label="Guard Total" value={formatCurrency(fees.guardTotal)} />
                <InfoRow label="Service Fee" value={`${formatCurrency(fees.serviceFee)} (${fees.serviceFeeLabel})`} />
                <InfoRow label="Total to Pay" value={formatCurrency(fees.total)} />
              </>
            )}
            <InfoRow label="Contact" value={formData.contactName} />
            <InfoRow label="Phone" value={formData.contactPhone} />
            <InfoRow label="Email" value={formData.contactEmail} />
          </Section>
        </div>

        {submitStatus === 'success' && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-start gap-3 mt-6">
            <i className="ri-checkbox-circle-fill text-emerald-400 text-xl w-6 h-6 flex items-center justify-center"></i>
            <div>
              <h3 className="font-semibold text-emerald-400">Job Posted Successfully!</h3>
              <p className="text-slate-400 text-sm">Redirecting to your jobs...</p>
            </div>
          </div>
        )}

        {submitStatus === 'error' && errors.submit && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 flex items-start gap-3 mt-6">
            <i className="ri-error-warning-fill text-red-400 text-xl w-6 h-6 flex items-center justify-center"></i>
            <div>
              <h3 className="font-semibold text-red-400">Submission Failed</h3>
              <p className="text-red-400/80 text-sm">{errors.submit}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-8">
          <button type="button" onClick={onBack} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap px-4 py-3">
            <i className="ri-arrow-left-line mr-1"></i> Back
          </button>
          <div className="flex-1"></div>
          <button type="button" onClick={onSaveDraft} className="border border-[#1e2d4d] text-slate-300 px-5 py-3 rounded-xl font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2">
            {draftSaveStatus === 'saving' ? (
              <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>Saving...</>
            ) : draftSaveStatus === 'saved' ? (
              <><i className="ri-checkbox-circle-line text-emerald-400"></i>Saved</>
            ) : (
              <><i className="ri-save-line"></i>Save Draft</>
            )}
          </button>
          <button type="button" onClick={onSaveTemplate} className="border border-teal-500/30 text-teal-400 px-5 py-3 rounded-xl font-semibold hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2">
            <i className="ri-file-copy-line"></i>Save as Template
          </button>
          <button
            type="button"
            onClick={onPost}
            disabled={submitting || submitStatus === 'success'}
            className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            {submitting ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Posting Job...</>
            ) : (
              <><i className="ri-send-plane-line"></i>Post Job</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}