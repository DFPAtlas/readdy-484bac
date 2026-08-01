'use client';

import { useState } from 'react';
import { JobRow } from './useAdminJobs';

interface JobStatusModalProps {
  job: JobRow | null;
  updating: boolean;
  onClose: () => void;
  onChangeStatus: (newStatus: string, note: string) => void;
}

export default function JobStatusModal({ job, updating, onClose, onChangeStatus }: JobStatusModalProps) {
  const [newStatus, setNewStatus] = useState(job?.status || '');
  const [statusNote, setStatusNote] = useState('');

  if (!job) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-8 shadow-xl border border-[#1e2d4d]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 flex items-center justify-center bg-sky-500/10 rounded-2xl mx-auto mb-4 ring-1 ring-sky-500/20">
            <div className="w-6 h-6 flex items-center justify-center"><i className="ri-edit-circle-line text-2xl text-sky-400"></i></div>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">Change Status</h2>
          <p className="text-sm text-slate-400">{job.job_title}</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-bold text-slate-300 mb-2">New Status</label>
          <div className="relative">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              className="w-full pl-4 pr-8 py-3 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all appearance-none cursor-pointer">
              <option value="">Select status...</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="awaiting_guard_selection">Awaiting Selection</option>
            </select>
            <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <i className="ri-arrow-down-s-line text-sm"></i>
            </div>
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-300 mb-2">Note (optional)</label>
          <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Reason for status change..."
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white bg-[#0a1527] resize-none h-24 placeholder:text-slate-500" />
          <p className="text-xs text-slate-500 mt-1">{statusNote.length}/500</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={updating}
            className="flex-1 px-4 py-3 bg-[#1a2642] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e2d4d] transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer">Cancel</button>
          <button onClick={() => onChangeStatus(newStatus, statusNote)} disabled={!newStatus || updating}
            className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-all whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer">
            {updating ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Updating...</> : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
}