'use client';

import { useState } from 'react';

interface JobWithSafety {
  id: string;
  job_title: string;
  venue_name: string;
  status: string;
  start_date: string;
  risk_level: string | null;
  lone_worker_flag: boolean;
  safety_check?: {
    id: string;
    site_address_confirmed: boolean;
    site_contact_available: boolean;
    emergency_contact_added: boolean;
    site_access_instructions_added: boolean;
    risk_notes_added: boolean;
    lone_worker_flagged: boolean;
    parking_details_added: boolean;
    required_sia_selected: boolean;
  };
  sia_licence_required: boolean;
  required_license_type: string | null;
}

interface JobSafetyChecklistProps {
  jobs: JobWithSafety[];
  onToggle: (jobId: string, checkId: string | undefined, field: string, value: boolean) => void;
  onChangeRisk: (jobId: string, riskLevel: string) => void;
  onChangeLoneWorker: (jobId: string, value: boolean) => void;
}

const checklistItems: { key: string; label: string; icon: string; description: string }[] = [
  { key: 'site_address_confirmed', label: 'Site Address Confirmed', icon: 'ri-map-pin-line', description: 'The venue address is correct and verified.' },
  { key: 'site_contact_available', label: 'Site Contact Available', icon: 'ri-user-search-line', description: 'A named site contact is available on shift day.' },
  { key: 'emergency_contact_added', label: 'Emergency Contact Added', icon: 'ri-phone-line', description: 'Emergency contact details are saved for this job.' },
  { key: 'site_access_instructions_added', label: 'Site Access Instructions Added', icon: 'ri-door-open-line', description: 'Entry instructions, keys, or access codes are provided.' },
  { key: 'risk_notes_added', label: 'Risk Notes Added', icon: 'ri-alert-line', description: 'Any site-specific risks or hazards are documented.' },
  { key: 'lone_worker_flagged', label: 'Lone Worker Flagged', icon: 'ri-user-location-line', description: 'Flagged if guards may work alone for long periods.' },
  { key: 'parking_details_added', label: 'Parking Details Added', icon: 'ri-parking-box-line', description: 'Parking or travel access instructions are provided.' },
  { key: 'required_sia_selected', label: 'Required SIA Licence Selected', icon: 'ri-shield-check-line', description: 'The correct SIA licence type is selected for this job.' },
];

const riskOptions = [
  { value: 'low', label: 'Low', color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/15' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/25', bg: 'bg-amber-500/15' },
  { value: 'high', label: 'High', color: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/25', bg: 'bg-orange-500/15' },
  { value: 'urgent', label: 'Urgent Review', color: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/25', bg: 'bg-red-500/15' },
];

export default function JobSafetyChecklist({ jobs, onToggle, onChangeRisk, onChangeLoneWorker }: JobSafetyChecklistProps) {
  const [selectedJob, setSelectedJob] = useState<string>(jobs[0]?.id || '');
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const filtered = jobs.filter((j) => {
    const matchSearch = j.job_title.toLowerCase().includes(search.toLowerCase()) || j.venue_name.toLowerCase().includes(search.toLowerCase());
    const matchRisk = filterRisk === 'all' || j.risk_level === filterRisk;
    return matchSearch && matchRisk;
  });

  const job = jobs.find((j) => j.id === selectedJob) || filtered[0];

  const completion = (j: JobWithSafety) => {
    const sc = j.safety_check || {};
    const completed = checklistItems.filter((item) => (sc as any)[item.key]).length;
    return { completed, total: checklistItems.length, pct: Math.round((completed / checklistItems.length) * 100) };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterRisk('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-all cursor-pointer ${
              filterRisk === 'all'
                ? 'bg-teal-500 text-white border-teal-500'
                : 'bg-white dark:bg-[#111d35] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e2d4d]'
            }`}
          >
            All Risk
          </button>
          {riskOptions.map((r) => (
            <button
              key={r.value}
              onClick={() => setFilterRisk(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-all cursor-pointer ${
                filterRisk === r.value
                  ? `${r.bg} ${r.text} ${r.border}`
                  : 'bg-white dark:bg-[#111d35] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e2d4d]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-briefcase-4-line text-2xl text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No jobs found</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((j) => {
              const c = completion(j);
              const risk = riskOptions.find((r) => r.value === j.risk_level) || riskOptions[0];
              return (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedJob === j.id
                      ? 'bg-teal-500/10 border-teal-500/30'
                      : 'bg-white dark:bg-[#111d35] border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate pr-2">{j.job_title}</p>
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${risk.bg} ${risk.text} ${risk.border}`}>
                      {risk.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{j.venue_name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-[#1e2d4d] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${c.pct === 100 ? 'bg-emerald-500' : c.pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${c.pct === 100 ? 'text-emerald-400' : 'text-slate-500'}`}>{c.completed}/{c.total}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {job && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{job.job_title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{job.venue_name} &middot; {job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB') : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Risk:</span>
                    <div className="flex items-center gap-1">
                      {riskOptions.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => onChangeRisk(job.id, r.value)}
                          className={`w-3 h-3 rounded-full cursor-pointer transition-all ring-2 ${
                            job.risk_level === r.value ? `${r.color} ring-white/50` : 'bg-slate-300 dark:bg-[#1e2d4d] ring-transparent'
                          }`}
                          title={r.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {checklistItems.map((item) => {
                    const checked = (job.safety_check as any)?.[item.key] || false;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onToggle(job.id, job.safety_check?.id, item.key, !checked)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          checked
                            ? 'bg-emerald-500/5 border-emerald-500/25'
                            : 'bg-slate-50 dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-100 dark:hover:bg-[#1a2642]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          checked
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {checked && <i className="ri-check-line text-white text-xs" />}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {item.label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}