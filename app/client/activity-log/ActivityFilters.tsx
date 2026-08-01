'use client';

interface ActivityFiltersProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  actionFilter: string;
  onActionChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  relatedJobFilter: string;
  onRelatedJobChange: (v: string) => void;
  jobs: { id: string; job_title: string }[];
  onClear: () => void;
  onApply: () => void;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'account', label: 'Account' },
  { value: 'job', label: 'Job' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'guard', label: 'Guard' },
  { value: 'payment', label: 'Payment' },
  { value: 'message', label: 'Message' },
  { value: 'support', label: 'Support' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'refund', label: 'Refund' },
  { value: 'document', label: 'Document' },
  { value: 'site', label: 'Site' },
  { value: 'review', label: 'Review' },
];

const ACTION_TYPES = [
  { value: 'all', label: 'All Activity' },
  { value: 'account_created', label: 'Account Created' },
  { value: 'profile_updated', label: 'Profile Updated' },
  { value: 'job_created', label: 'Job Created' },
  { value: 'job_edited', label: 'Job Edited' },
  { value: 'job_posted', label: 'Job Posted' },
  { value: 'applicant_reviewed', label: 'Applicant Reviewed' },
  { value: 'guard_selected', label: 'Guard Selected' },
  { value: 'guard_confirmed', label: 'Guard Confirmed' },
  { value: 'payment_made', label: 'Payment Made' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'payment_refunded', label: 'Payment Refunded' },
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'ticket_created', label: 'Ticket Created' },
  { value: 'ticket_updated', label: 'Ticket Updated' },
  { value: 'cancellation_requested', label: 'Cancellation Requested' },
  { value: 'job_cancelled', label: 'Job Cancelled' },
  { value: 'refund_requested', label: 'Refund Requested' },
  { value: 'document_uploaded', label: 'Document Uploaded' },
  { value: 'site_created', label: 'Site Created' },
  { value: 'site_updated', label: 'Site Updated' },
  { value: 'review_submitted', label: 'Review Submitted' },
  { value: 'check_in', label: 'Check In' },
  { value: 'check_out', label: 'Check Out' },
  { value: 'booking_confirmed', label: 'Booking Confirmed' },
  { value: 'job_completed', label: 'Job Completed' },
  { value: 'terms_accepted', label: 'Terms Accepted' },
  { value: 'complaint_raised', label: 'Complaint Raised' },
  { value: 'replacement_requested', label: 'Replacement Requested' },
];

export default function ActivityFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  actionFilter,
  onActionChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  relatedJobFilter,
  onRelatedJobChange,
  jobs,
  onClear,
  onApply,
}: ActivityFiltersProps) {
  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search activity..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
        </div>
        <div className="relative">
          <i className="ri-folder-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 appearance-none cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-[#162036] text-white">
                {c.label}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
        </div>
        <div className="relative">
          <i className="ri-file-list-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <select
            value={actionFilter}
            onChange={(e) => onActionChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 appearance-none cursor-pointer"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value} className="bg-[#162036] text-white">
                {a.label}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
        </div>
        <div className="relative">
          <i className="ri-briefcase-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <select
            value={relatedJobFilter}
            onChange={(e) => onRelatedJobChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 appearance-none cursor-pointer"
          >
            <option value="" className="bg-[#162036] text-white">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id} className="bg-[#162036] text-white">
                {j.job_title}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
        </div>
        <div className="relative">
          <i className="ri-calendar-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">From</span>
        </div>
        <div className="relative">
          <i className="ri-calendar-check-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">To</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#1e2d4d]">
        <button
          onClick={onApply}
          className="px-4 py-2 bg-teal-500 text-slate-900 rounded-xl text-sm font-medium hover:bg-teal-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          Apply Filters
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm cursor-pointer whitespace-nowrap"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}