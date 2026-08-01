'use client';

import Link from 'next/link';

interface JobInfoSectionProps {
  job: any;
}

export default function JobInfoSection({ job }: JobInfoSectionProps) {
  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const fields = [
    { icon: 'ri-map-pin-2-line', label: 'Venue Name', value: job.venue_name || '—' },
    { icon: 'ri-road-map-line', label: 'Address', value: [job.venue_address_line1, job.venue_address_line2, job.venue_city, job.venue_postcode].filter(Boolean).join(', ') || '—' },
    { icon: 'ri-calendar-event-line', label: 'Start Date', value: formatDate(job.start_date) },
    { icon: 'ri-calendar-check-line', label: 'End Date', value: formatDate(job.end_date) },
    { icon: 'ri-time-line', label: 'Hours', value: job.start_time && job.end_time ? `${job.start_time} – ${job.end_time}` : '—' },
    { icon: 'ri-group-line', label: 'Guards Needed', value: job.number_of_guards ? `${job.number_of_guards} guard${job.number_of_guards !== 1 ? 's' : ''}` : '—' },
    { icon: 'ri-money-pound-circle-line', label: 'Hourly Rate', value: job.hourly_rate ? `£${job.hourly_rate}/hr` : '—' },
    { icon: 'ri-shield-check-line', label: 'SIA Licence Required', value: job.sia_licence_required ? 'Yes' : 'No' },
    { icon: 'ri-file-list-3-line', label: 'Uniform Required', value: job.uniform_required ? 'Yes' : 'No' },
    { icon: 'ri-calendar-line', label: 'Posted On', value: formatDate(job.created_at) },
  ];

  const riskLevelColors: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
    high: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25' },
    urgent: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25' },
  };
  const risk = riskLevelColors[job.risk_level || 'low'] || riskLevelColors.low;

  return (
    <div className="space-y-6">
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <i className="ri-information-line text-teal-400 text-lg"></i>
            </div>
            Job Details
          </h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${risk.bg} ${risk.text} ${risk.border}`}>
            Risk: {(job.risk_level || 'low').replace(/^\w/, (c: string) => c.toUpperCase())}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
              <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                <i className={`${f.icon} text-teal-400 text-base`}></i>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">{f.label}</p>
                <p className="text-sm font-semibold text-slate-200">{f.value}</p>
              </div>
            </div>
          ))}
          {job.saved_site_id && (
            <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d] col-span-2">
              <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                <i className="ri-building-line text-teal-400 text-base"></i>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">Saved Site</p>
                <Link
                  href={`/client/sites`}
                  className="text-sm font-semibold text-teal-400 hover:text-teal-300 cursor-pointer"
                >
                  View site details <i className="ri-arrow-right-line text-xs"></i>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Safety & Site Info */}
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-shield-check-line text-teal-400 text-lg"></i>
          </div>
          Safety & Site Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-user-location-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Lone Worker</p>
              <p className="text-sm font-semibold text-slate-200">{job.lone_worker_flag ? 'Flagged' : 'Not Flagged'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-door-open-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Site Access</p>
              <p className="text-sm font-semibold text-slate-200">{job.site_access_instructions ? 'Instructions Saved' : 'No Instructions'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-parking-box-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Parking</p>
              <p className="text-sm font-semibold text-slate-200">{job.parking_instructions ? 'Instructions Saved' : 'No Instructions'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-phone-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Emergency Contact</p>
              <p className="text-sm font-semibold text-slate-200">{job.emergency_contact_name || job.emergency_contact_phone ? 'Saved' : 'Not Set'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-time-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Out-of-Hours Contact</p>
              <p className="text-sm font-semibold text-slate-200">{job.out_of_hours_contact_name || job.out_of_hours_contact_phone ? 'Saved' : 'Not Set'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-first-aid-kit-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Emergency Process</p>
              <p className="text-sm font-semibold text-slate-200">{job.emergency_process ? 'Saved' : 'Not Set'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-footprint-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">Patrol Expectations</p>
              <p className="text-sm font-semibold text-slate-200">{job.patrol_expectations ? 'Saved' : 'Not Set'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
              <i className="ri-camera-line text-teal-400 text-base"></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-0.5">CCTV / Control Room</p>
              <p className="text-sm font-semibold text-slate-200">{job.cctv_details ? 'Saved' : 'Not Set'}</p>
            </div>
          </div>
        </div>
      </div>

      {job.job_description && (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <i className="ri-align-left text-teal-400 text-lg"></i>
            </div>
            Job Description
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{job.job_description}</p>
        </div>
      )}

      {job.special_instructions && (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <i className="ri-alert-line text-amber-400 text-lg"></i>
            </div>
            Special Instructions
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{job.special_instructions}</p>
        </div>
      )}
    </div>
  );
}
