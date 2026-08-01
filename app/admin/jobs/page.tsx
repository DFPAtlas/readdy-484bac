'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminJobs, JobRow } from './useAdminJobs';
import { useJobApplicants, ApplicantRow } from './useJobApplicants';
import JobFilters from './JobFilters';
import JobsTable from './JobsTable';
import JobBulkActions from './JobBulkActions';
import JobDetailModal from './JobDetailModal';
import JobStatusModal from './JobStatusModal';
import JobDeleteModal from './JobDeleteModal';
import JobFlagModal from './JobFlagModal';
import PaymentStatusPanel from './PaymentStatusPanel';
import CompletionRequestsPanel from './CompletionRequestsPanel';
import DisputesPanel from './DisputesPanel';

interface Toast { message: string; type: 'success' | 'error' | 'info'; }

export default function AdminJobsPage() {
  const {
    jobs, loading, error, page, pageSize, totalCount, stats,
    filters, setFilter, clearFilters, goToPage, refresh,
    deleteJob, changeStatus, flagJob, unflagJob, bulkAction,
  } = useAdminJobs();

  const {
    applicants, loading: applicantsLoading,
    fetchApplicants, clearApplicants,
    acceptApplicant, declineApplicant,
  } = useJobApplicants();

  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState<JobRow | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobRow | null>(null);
  const [showFlag, setShowFlag] = useState(false);
  const [flagTarget, setFlagTarget] = useState<JobRow | null>(null);

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const cities = useMemo(() => {
    return Array.from(new Set(jobs.map(j => j.venue_city).filter(Boolean))).sort();
  }, [jobs]);

  const showToast = (message: string, type: Toast['type']) => setToast({ message, type });

  const openDetail = useCallback((job: JobRow) => {
    setSelectedJob(job);
    setShowDetail(true);
    fetchApplicants(job.id);
  }, [fetchApplicants]);

  const closeDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedJob(null);
    clearApplicants();
  }, [clearApplicants]);

  const openDelete = useCallback((job: JobRow) => { setJobToDelete(job); setShowDelete(true); }, []);
  const closeDelete = useCallback(() => { setShowDelete(false); setJobToDelete(null); }, []);

  const openStatus = useCallback((job: JobRow) => { setStatusTarget(job); setShowStatusModal(true); }, []);
  const closeStatus = useCallback(() => { setShowStatusModal(false); setStatusTarget(null); }, []);

  const openFlag = useCallback((job: JobRow) => { setFlagTarget(job); setShowFlag(true); }, []);
  const closeFlag = useCallback(() => { setShowFlag(false); setFlagTarget(null); }, []);

  const handleDelete = async () => {
    if (!jobToDelete) return;
    setMutating(true);
    try {
      await deleteJob(jobToDelete.id);
      showToast('Job deleted and client notified', 'success');
      closeDelete();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete job', 'error');
    } finally { setMutating(false); }
  };

  const handleStatusChange = async (newStatus: string, note: string) => {
    if (!statusTarget || !newStatus) return;
    setMutating(true);
    try {
      await changeStatus(statusTarget.id, newStatus, note);
      showToast(`Status updated to ${newStatus}`, 'success');
      if (selectedJob?.id === statusTarget.id) setSelectedJob(prev => prev ? { ...prev, status: newStatus } : null);
      closeStatus();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally { setMutating(false); }
  };

  const handleFlag = async (reason: string) => {
    if (!flagTarget) return;
    setMutating(true);
    try {
      await flagJob(flagTarget.id, reason);
      showToast(`Job flagged as ${reason}`, 'success');
      closeFlag();
    } catch (err: any) {
      showToast(err.message || 'Failed to flag job', 'error');
    } finally { setMutating(false); }
  };

  const handleUnflag = async (job: JobRow) => {
    try {
      await unflagJob(job.id);
      showToast('Flag removed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to unflag job', 'error');
    }
  };

  const handleAccept = async (app: ApplicantRow) => {
    if (!selectedJob) return;
    try {
      await acceptApplicant(app.id, selectedJob.id, app.guard_id);
      showToast('Application accepted and guard assigned', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to accept application', 'error');
    }
  };

  const handleDecline = async (app: ApplicantRow) => {
    if (!selectedJob) return;
    try {
      await declineApplicant(app.id, selectedJob.id, app.guard_id);
      showToast('Application declined', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to decline application', 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedJobIds.size === jobs.length && jobs.length > 0) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(jobs.map(j => j.id)));
    }
  };

  const toggleSelectJob = (id: string) => {
    const next = new Set(selectedJobIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedJobIds(next);
  };

  const handleBulkApply = async (action: string) => {
    if (!action || selectedJobIds.size === 0) return;
    setMutating(true);
    try {
      const ids = Array.from(selectedJobIds);
      await bulkAction(ids, action);
      showToast(`${ids.length} jobs ${action}ed`, 'success');
      setSelectedJobIds(new Set());
    } catch (err: any) {
      showToast(err.message || 'Bulk action failed', 'error');
    } finally { setMutating(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border text-sm font-semibold transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500'
          : toast.type === 'error' ? 'bg-red-600 text-white border-red-500'
          : 'bg-sky-600 text-white border-sky-500'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${
              toast.type === 'success' ? 'ri-checkbox-circle-fill text-white'
              : toast.type === 'error' ? 'ri-error-warning-fill text-white'
              : 'ri-information-line text-white'
            } text-lg`}></i>
          </div>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/25">
            <i className="ri-briefcase-line text-xl"></i>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Job Oversight</h1>
        </div>
        <p className="text-sm text-slate-400 font-medium">Manage, monitor, and moderate all job postings across the platform</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: 'Total Jobs', value: stats.total, icon: 'ri-briefcase-line', color: 'text-slate-400', bg: 'bg-[#111d35]', ring: 'ring-[#1e2d4d]' },
          { label: 'Open', value: stats.open, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
          { label: 'In Progress', value: stats.in_progress, icon: 'ri-loader-4-line', color: 'text-sky-400', bg: 'bg-sky-500/10', ring: 'ring-sky-500/20' },
          { label: 'Completed', value: stats.completed, icon: 'ri-check-double-line', color: 'text-slate-400', bg: 'bg-[#111d35]', ring: 'ring-[#1e2d4d]' },
          { label: 'Cancelled', value: stats.cancelled, icon: 'ri-close-circle-line', color: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20' },
          { label: 'Pending Apps', value: stats.pending_apps, icon: 'ri-file-list-line', color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
          { label: 'Flagged', value: stats.flagged, icon: 'ri-flag-line', color: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/20' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl ${stat.bg} ${stat.ring} ring-1 px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={`${stat.icon} ${stat.color} text-sm`}></i>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <JobFilters
        search={filters.search}
        filterStatus={filters.filterStatus}
        filterUrgency={filters.filterUrgency}
        filterCity={filters.filterCity}
        filterSia={filters.filterSia}
        filterFlagged={filters.filterFlagged}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        sortBy={filters.sortBy}
        cities={cities}
        loading={loading}
        onRefresh={refresh}
        onSearchChange={(v) => setFilter('search', v)}
        onFilterChange={(k, v) => setFilter(k, v)}
        onDateChange={(k, v) => setFilter(k, v)}
        onClearFilters={clearFilters}
      />

      {selectedJobIds.size > 0 && (
        <JobBulkActions
          selectedCount={selectedJobIds.size}
          processing={mutating}
          onApply={handleBulkApply}
          onClear={() => setSelectedJobIds(new Set())}
        />
      )}

      <JobsTable
        jobs={jobs}
        loading={loading}
        error={error}
        selectedJobIds={selectedJobIds}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectJob={toggleSelectJob}
        onOpenDetail={openDetail}
        onOpenStatus={openStatus}
        onOpenFlag={openFlag}
        onUnflag={handleUnflag}
        onOpenDelete={openDelete}
        onRetry={refresh}
        onPageChange={goToPage}
      />

      {showDetail && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          applicants={applicants}
          applicantsLoading={applicantsLoading}
          onClose={closeDetail}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onStatusClick={() => { closeDetail(); openStatus(selectedJob); }}
        />
      )}

      {showStatusModal && (
        <JobStatusModal
          job={statusTarget}
          updating={mutating}
          onClose={closeStatus}
          onChangeStatus={handleStatusChange}
        />
      )}

      {showDelete && (
        <JobDeleteModal
          job={jobToDelete}
          deleting={mutating}
          onClose={closeDelete}
          onDelete={handleDelete}
        />
      )}

      {showFlag && (
        <JobFlagModal
          job={flagTarget}
          flagging={mutating}
          onClose={closeFlag}
          onFlag={handleFlag}
        />
      )}

      <PaymentStatusPanel />

      <CompletionRequestsPanel />

      <DisputesPanel />
    </div>
  );
}