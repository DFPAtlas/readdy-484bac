'use client';

import Link from 'next/link';
import { JobRow } from './useAdminJobs';

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

const urgencyConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  immediate: { label: 'Immediate', bg: 'bg-red-500/10', text: 'text-red-400', icon: 'ri-flashlight-line' },
  urgent: { label: 'Urgent', bg: 'bg-orange-500/10', text: 'text-orange-400', icon: 'ri-alarm-warning-line' },
  high: { label: 'High', bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'ri-arrow-up-line' },
  normal: { label: 'Normal', bg: 'bg-sky-500/10', text: 'text-sky-400', icon: 'ri-time-line' },
  standard: { label: 'Standard', bg: 'bg-slate-500/10', text: 'text-slate-400', icon: 'ri-time-line' },
};

interface JobsTableProps {
  jobs: JobRow[];
  loading: boolean;
  error: string | null;
  selectedJobIds: Set<string>;
  totalCount: number;
  page: number;
  pageSize: number;
  onToggleSelectAll: () => void;
  onToggleSelectJob: (id: string) => void;
  onOpenDetail: (job: JobRow) => void;
  onOpenStatus: (job: JobRow) => void;
  onOpenFlag: (job: JobRow) => void;
  onUnflag: (job: JobRow) => void;
  onOpenDelete: (job: JobRow) => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

export default function JobsTable({
  jobs, loading, error, selectedJobIds, totalCount, page, pageSize,
  onToggleSelectAll, onToggleSelectJob, onOpenDetail, onOpenStatus,
  onOpenFlag, onUnflag, onOpenDelete, onRetry, onPageChange,
}: JobsTableProps) {
  const getStatusBadge = (status: string) => statusConfig[status] || statusConfig.open;
  const getUrgencyBadge = (urgency: string | null) => urgency ? (urgencyConfig[urgency] || null) : null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1e2d4d] flex items-center justify-between">
        <p className="text-sm text-slate-400 font-semibold">{totalCount} jobs found</p>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
            Loading...
          </div>
        )}
      </div>

      {error ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20 mx-auto mb-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-error-warning-line text-2xl"></i>
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Failed to load jobs</h3>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button onClick={onRetry} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-all whitespace-nowrap cursor-pointer">
            Retry
          </button>
        </div>
      ) : jobs.length === 0 && !loading ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#1a2642] text-slate-500 mx-auto mb-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-briefcase-line text-2xl"></i>
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No jobs found</h3>
          <p className="text-sm text-slate-400">Try adjusting your filters or search terms</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a1527] border-b border-[#1e2d4d]">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={jobs.length > 0 && selectedJobIds.size === jobs.length}
                      onChange={onToggleSelectAll}
                      className="w-4 h-4 text-teal-500 rounded border-slate-600 bg-[#0a1527] focus:ring-teal-500 cursor-pointer" />
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Guards</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Apps</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const sb = getStatusBadge(job.status);
                  const ub = getUrgencyBadge(job.urgency);
                  const isSelected = selectedJobIds.has(job.id);
                  return (
                    <tr key={job.id} className={`border-b border-[#1a2642] hover:bg-[#1a2642]/50 transition-colors ${isSelected ? 'bg-teal-500/5' : ''} ${job.risk_level ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelectJob(job.id)}
                          className="w-4 h-4 text-teal-500 rounded border-slate-600 bg-[#0a1527] focus:ring-teal-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{job.job_title}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {ub && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${ub.bg} ${ub.text}`}>
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className={`${ub.icon} text-[8px]`}></i>
                                </div>
                                {ub.label}
                              </span>
                            )}
                            {job.sia_licence_required && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400">
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className="ri-shield-check-line text-[8px]"></i>
                                </div>
                                SIA
                              </span>
                            )}
                            {job.risk_level && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400">
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className="ri-flag-line text-[8px]"></i>
                                </div>
                                {job.risk_level}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-medium text-slate-300">{job.clients?.company_name || 'Private'}</span></td>
                      <td className="px-4 py-3 text-slate-400">{job.venue_city}{job.venue_postcode ? `, ${job.venue_postcode}` : ''}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(job.start_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${sb.bg} ${sb.text} ring-1 ${sb.ring}`}>
                          <div className="w-3 h-3 flex items-center justify-center"><i className={`${sb.icon} text-[10px]`}></i></div>
                          {sb.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-white whitespace-nowrap">£{Number(job.hourly_rate).toFixed(2)}/hr</td>
                      <td className="px-4 py-3 text-slate-400">{job.number_of_guards}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{job.applications_count}</span>
                          {job.pending_applications_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-bold">
                              {job.pending_applications_count} pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-teal-500/10 text-slate-500 hover:text-teal-400 transition-all cursor-pointer" title="View public page">
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-eye-line text-sm"></i></div>
                          </Link>
                          <button onClick={() => onOpenDetail(job)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2642] text-slate-500 hover:text-slate-300 transition-all cursor-pointer" title="Manage applicants &amp; details">
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-list-3-line text-sm"></i></div>
                          </button>
                          <button onClick={() => onOpenStatus(job)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2642] text-slate-500 hover:text-slate-300 transition-all cursor-pointer" title="Change status">
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-edit-circle-line text-sm"></i></div>
                          </button>
                          {job.risk_level ? (
                            <button onClick={() => onUnflag(job)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-all cursor-pointer" title="Unflag job">
                              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-flag-fill text-sm"></i></div>
                            </button>
                          ) : (
                            <button onClick={() => onOpenFlag(job)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer" title="Flag job">
                              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-flag-line text-sm"></i></div>
                            </button>
                          )}
                          <button onClick={() => onOpenDelete(job)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer" title="Delete job">
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line text-sm"></i></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e2d4d]">
              <p className="text-sm text-slate-400">
                Showing <span className="font-semibold text-slate-200">{startItem}</span> to <span className="font-semibold text-slate-200">{endItem}</span> of <span className="font-semibold text-slate-200">{totalCount}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onPageChange(1)} disabled={page === 1}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}>
                  <i className="ri-skip-back-mini-line"></i>
                </button>
                <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}>
                  <i className="ri-arrow-left-s-line"></i>
                </button>
                {getPageNumbers().map((p, idx) =>
                  typeof p === 'string' ? (
                    <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-600 text-sm">...</span>
                  ) : (
                    <button key={p} onClick={() => onPageChange(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${page === p ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}>
                  <i className="ri-arrow-right-s-line"></i>
                </button>
                <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}>
                  <i className="ri-skip-forward-mini-line"></i>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}