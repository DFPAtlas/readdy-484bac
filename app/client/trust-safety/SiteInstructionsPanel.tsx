'use client';

import { useState } from 'react';

interface JobWithSafety {
  id: string;
  job_title: string;
  venue_name: string;
  status: string;
  start_date: string;
  site_access_instructions: string | null;
  parking_instructions: string | null;
  patrol_expectations: string | null;
  cctv_details: string | null;
  emergency_process: string | null;
  special_instructions: string | null;
  dress_code: string | null;
  uniform_required: boolean;
  uniform_details: string | null;
  additional_requirements: string | null;
}

interface SiteInstructionsPanelProps {
  jobs: JobWithSafety[];
  onSave: (jobId: string, fields: Record<string, string | null>) => void;
}

export default function SiteInstructionsPanel({ jobs, onSave }: SiteInstructionsPanelProps) {
  const [selectedJob, setSelectedJob] = useState<string>(jobs[0]?.id || '');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const filtered = jobs.filter((j) =>
    j.job_title.toLowerCase().includes(search.toLowerCase()) ||
    j.venue_name.toLowerCase().includes(search.toLowerCase())
  );

  const job = jobs.find((j) => j.id === selectedJob) || filtered[0];

  const startEditing = () => {
    if (!job) return;
    setForm({
      site_access_instructions: job.site_access_instructions || '',
      parking_instructions: job.parking_instructions || '',
      patrol_expectations: job.patrol_expectations || '',
      cctv_details: job.cctv_details || '',
      emergency_process: job.emergency_process || '',
      special_instructions: job.special_instructions || '',
      dress_code: job.dress_code || '',
      uniform_details: job.uniform_details || '',
      additional_requirements: job.additional_requirements || '',
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!job) return;
    const updates: Record<string, string | null> = {};
    Object.entries(form).forEach(([key, value]) => {
      updates[key] = value.trim() || null;
    });
    onSave(job.id, updates);
    setEditing(false);
  };

  const fields = [
    { key: 'site_access_instructions', label: 'Entry / Access Instructions', icon: 'ri-door-open-line', placeholder: 'How guards enter the site, keys, fobs, codes, entry points...' },
    { key: 'parking_instructions', label: 'Parking Instructions', icon: 'ri-parking-box-line', placeholder: 'Where to park, permit requirements, nearby car parks...' },
    { key: 'patrol_expectations', label: 'Patrol Expectations', icon: 'ri-footprint-line', placeholder: 'Patrol routes, frequency, checkpoints, areas to cover...' },
    { key: 'cctv_details', label: 'CCTV / Control Room', icon: 'ri-camera-line', placeholder: 'CCTV coverage, control room contact, monitoring details...' },
    { key: 'emergency_process', label: 'Emergency Process', icon: 'ri-first-aid-kit-line', placeholder: 'Emergency procedures, evacuation routes, assembly points...' },
    { key: 'special_instructions', label: 'Special Instructions', icon: 'ri-alert-line', placeholder: 'Any special instructions for this site...' },
    { key: 'dress_code', label: 'Dress Code / Uniform', icon: 'ri-shirt-line', placeholder: 'Uniform or dress code requirements...' },
    { key: 'uniform_details', label: 'Uniform Details', icon: 'ri-t-shirt-line', placeholder: 'Specific uniform details, provided by client or guard...' },
    { key: 'additional_requirements', label: 'Additional Requirements', icon: 'ri-list-check-2', placeholder: 'Any other site-specific requirements...' },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs..."
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-file-list-line text-2xl text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No jobs found</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((j) => {
              const hasInfo = !!(
                j.site_access_instructions || j.parking_instructions || j.patrol_expectations ||
                j.cctv_details || j.emergency_process || j.special_instructions || j.dress_code
              );
              return (
                <button
                  key={j.id}
                  onClick={() => { setSelectedJob(j.id); setEditing(false); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedJob === j.id
                      ? 'bg-teal-500/10 border-teal-500/30'
                      : 'bg-white dark:bg-[#111d35] border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate pr-2">{j.job_title}</p>
                    {hasInfo ? (
                      <span className="shrink-0 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                        Info Saved
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
                        Missing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{j.venue_name}</p>
                </button>
              );
            })}
          </div>

          {job && (
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{job.job_title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{job.venue_name}</p>
                  </div>
                  <button
                    onClick={() => editing ? handleSave() : startEditing()}
                    className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {editing ? <><i className="ri-save-line mr-1" />Save</> : <><i className="ri-edit-line mr-1" />Edit</>}
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((f) => {
                    const value = editing ? (form[f.key] || '') : (job as any)[f.key] || '';
                    return (
                      <div key={f.key}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <i className={`${f.icon} text-slate-500 dark:text-slate-400 text-xs`} />
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{f.label}</label>
                        </div>
                        {editing ? (
                          <textarea
                            value={value}
                            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            rows={2}
                            maxLength={500}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none"
                          />
                        ) : (
                          <div className={`px-3 py-2 rounded-lg text-sm border ${
                            value
                              ? 'bg-slate-50 dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-200'
                              : 'bg-amber-500/5 border-amber-500/20 text-amber-500 italic'
                          }`}>
                            {value || 'Not provided yet'}
                          </div>
                        )}
                      </div>
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