'use client';

import { useState } from 'react';
import { JobRow } from './useAdminJobs';

interface JobFlagModalProps {
  job: JobRow | null;
  flagging: boolean;
  onClose: () => void;
  onFlag: (reason: string) => void;
}

export default function JobFlagModal({ job, flagging, onClose, onFlag }: JobFlagModalProps) {
  const [flagReason, setFlagReason] = useState(job?.risk_level || 'suspicious');

  if (!job) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-8 shadow-xl border border-[#1e2d4d]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 flex items-center justify-center bg-rose-500/10 rounded-2xl mx-auto mb-4 ring-1 ring-rose-500/20">
            <div className="w-6 h-6 flex items-center justify-center"><i className="ri-flag-line text-2xl text-rose-400"></i></div>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">Flag Job</h2>
          <p className="text-sm text-slate-400">{job.job_title}</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-300 mb-2">Flag Reason</label>
          <div className="relative">
            <select value={flagReason} onChange={(e) => setFlagReason(e.target.value)}
              className="w-full pl-4 pr-8 py-3 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all appearance-none cursor-pointer">
              <option value="suspicious">Suspicious</option>
              <option value="incomplete">Incomplete Details</option>
              <option value="fake_client">Fake Client</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="spam">Spam / Duplicate</option>
              <option value="payment_issue">Payment Issue</option>
              <option value="other">Other</option>
            </select>
            <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <i className="ri-arrow-down-s-line text-sm"></i>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={flagging}
            className="flex-1 px-4 py-3 bg-[#1a2642] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e2d4d] transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer">Cancel</button>
          <button onClick={() => onFlag(flagReason)} disabled={flagging}
            className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer">
            {flagging ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Flagging...</> : 'Flag Job'}
          </button>
        </div>
      </div>
    </div>
  );
}