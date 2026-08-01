'use client';

import Link from 'next/link';
import { JobRow } from './useAdminJobs';
import { ApplicantRow } from './useJobApplicants';

interface JobDetailModalProps {
  job: JobRow;
  applicants: ApplicantRow[];
  applicantsLoading: boolean;
  onClose: () => void;
  onAccept: (app: ApplicantRow) => void;
  onDecline: (app: ApplicantRow) => void;
  onStatusClick: () => void;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; ring: string; icon: string }> = {
  open: { label: 'Open', bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20', icon: 'ri-checkbox-circle-line' },
  in_progress: { label: 'In Progress', bg: 'bg-sky-500/10', text: 'text-sky-400', ring: 'ring-sky-500/20', icon: 'ri-loader-4-line' },
  completed: { label: 'Completed', bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/20', icon: 'ri-check-double-line' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-500/10', text: 'text-red-400', ring: 'ring-red-500/20', icon: 'ri-close-circle-line' },
  paused: { label: 'Paused', bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20', icon: 'ri-pause-circle-line' },
  draft: { label: 'Draft', bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/20', icon: 'ri-draft-line' },
  pending: { label: 'Pending', bg: 'bg-purple-500/10', text: 'text-purple-400', ring: 'ring-purple-500/20', icon: 'ri-time-line' },
  awaiting_payment: { label: 'Awaiting Payment', bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20', icon: 'ri-money-pound-circle-line' },
  awaiting_guard_selection: { label: 'Awaiting Selection', bg: 'bg-pink-500/10', text: 'text-pink-400', ring: 'ring-pink-500/20', icon: 'ri-user-search-line' },
};

export default function JobDetailModal({ job, applicants, applicantsLoading, onClose, onAccept, onDecline, onStatusClick }: JobDetailModalProps) {
  const sb = statusConfig[job.status] || statusConfig.open;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-extrabold text-white">{job.job_title}</h2>
            <p className="text-sm text-slate-400 font-medium">{job.clients?.company_name || 'Unknown Client'} · {job.venue_city}</p>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1a2642] transition-all border border-[#1e2d4d] text-slate-400 cursor-pointer">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-close-line text-xl"></i></div>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#0a1527] rounded-xl p-4 ring-1 ring-[#1e2d4d]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${sb.bg} ${sb.text} ring-1 ${sb.ring}`}>
                {sb.label}
              </span>
            </div>
            <div className="bg-[#0a1527] rounded-xl p-4 ring-1 ring-[#1e2d4d]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rate</p>
              <p className="text-lg font-extrabold text-white">£{Number(job.hourly_rate).toFixed(2)}<span className="text-xs font-medium text-slate-400">/hr</span></p>
            </div>
            <div className="bg-[#0a1527] rounded-xl p-4 ring-1 ring-[#1e2d4d]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Guards</p>
              <p className="text-lg font-extrabold text-white">{job.number_of_guards} <span className="text-xs font-medium text-slate-400">needed</span></p>
            </div>
            <div className="bg-[#0a1527] rounded-xl p-4 ring-1 ring-[#1e2d4d]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Applications</p>
              <p className="text-lg font-extrabold text-white">{job.applications_count} <span className="text-xs font-medium text-slate-400">total</span></p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center text-teal-400"><i className="ri-user-line text-sm"></i></div>
                Applicants ({applicants.length})
              </h3>
              {applicantsLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </div>
              )}
            </div>

            {applicants.length === 0 && !applicantsLoading ? (
              <div className="bg-[#0a1527] rounded-xl p-8 text-center ring-1 ring-[#1e2d4d]">
                <p className="text-sm text-slate-400">No applications yet for this job</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applicants.map((app) => {
                  const guard = app.guards;
                  const appStatus = app.status;
                  return (
                    <div key={app.id} className="bg-[#0a1527] rounded-xl p-4 ring-1 ring-[#1e2d4d] flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">{guard?.full_name || 'Unknown Guard'}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            appStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                            : appStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                            : appStatus === 'declined' ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                            : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
                          }`}>
                            {appStatus.charAt(0).toUpperCase() + appStatus.slice(1)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-2">
                          {guard?.sia_licence_number && (
                            <span className="flex items-center gap-1"><div className="w-3 h-3 flex items-center justify-center"><i className="ri-shield-check-line text-[10px]"></i></div>{guard.sia_licence_number}</span>
                          )}
                          {guard?.licence_types && guard.licence_types.length > 0 && (
                            <span className="flex items-center gap-1"><div className="w-3 h-3 flex items-center justify-center"><i className="ri-vip-crown-line text-[10px]"></i></div>{guard.licence_types.join(', ')}</span>
                          )}
                          {guard?.years_experience != null && (
                            <span className="flex items-center gap-1"><div className="w-3 h-3 flex items-center justify-center"><i className="ri-briefcase-line text-[10px]"></i></div>{guard.years_experience} yrs exp</span>
                          )}
                          <span className="flex items-center gap-1"><div className="w-3 h-3 flex items-center justify-center"><i className="ri-mail-line text-[10px]"></i></div>{guard?.email || 'No email'}</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 flex items-center justify-center"><i className="ri-phone-line text-[10px]"></i></div>{guard?.phone || 'No phone'}</span>
                        </div>
                        {app.cover_letter && (
                          <p className="text-sm text-slate-300 leading-relaxed bg-[#111d35] rounded-lg p-3 ring-1 ring-[#1e2d4d]">{app.cover_letter}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {appStatus === 'pending' && (
                          <>
                            <button onClick={() => onAccept(app)}
                              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all whitespace-nowrap cursor-pointer">Accept</button>
                            <button onClick={() => onDecline(app)}
                              className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all ring-1 ring-red-500/20 whitespace-nowrap cursor-pointer">Decline</button>
                          </>
                        )}
                        {appStatus === 'accepted' && (
                          <span className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold ring-1 ring-emerald-500/20 whitespace-nowrap flex items-center gap-1">
                            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-checkbox-circle-line text-[10px]"></i></div>Accepted
                          </span>
                        )}
                        {appStatus === 'declined' && (
                          <span className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold ring-1 ring-red-500/20 whitespace-nowrap flex items-center gap-1">
                            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-close-circle-line text-[10px]"></i></div>Declined
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="px-5 py-3 bg-[#1a2642] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e2d4d] transition-all whitespace-nowrap cursor-pointer">Close</button>
            <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer"
              className="px-5 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-all whitespace-nowrap text-center inline-flex items-center justify-center gap-2 cursor-pointer">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-external-link-line text-sm"></i></div>View Public Page
            </Link>
            <button onClick={onStatusClick}
              className="px-5 py-3 bg-slate-600 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all whitespace-nowrap cursor-pointer">Change Status</button>
          </div>
        </div>
      </div>
    </div>
  );
}