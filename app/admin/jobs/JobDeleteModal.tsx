'use client';

import { JobRow } from './useAdminJobs';

interface JobDeleteModalProps {
  job: JobRow | null;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export default function JobDeleteModal({ job, deleting, onClose, onDelete }: JobDeleteModalProps) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-8 shadow-xl border border-[#1e2d4d]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 flex items-center justify-center bg-red-500/10 rounded-2xl mx-auto mb-4 ring-1 ring-red-500/20">
            <div className="w-6 h-6 flex items-center justify-center"><i className="ri-delete-bin-line text-2xl text-red-400"></i></div>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">Delete Job?</h2>
          <p className="text-sm text-slate-400">This action cannot be undone.</p>
        </div>
        <div className="bg-[#0a1527] rounded-xl p-4 mb-5 ring-1 ring-[#1e2d4d]">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Job Title</p>
          <p className="font-bold text-white">{job.job_title}</p>
          <p className="text-sm text-slate-400 mt-1">{job.clients?.company_name}</p>
        </div>
        <div className="bg-sky-500/10 rounded-xl p-4 mb-6 ring-1 ring-sky-500/20">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 flex items-center justify-center text-sky-400 mt-0.5"><i className="ri-information-line text-sm"></i></div>
            <p className="text-sm text-sky-400 font-medium">An email notification will be sent to the client.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 px-4 py-3 bg-[#1a2642] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e2d4d] transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer">Cancel</button>
          <button onClick={onDelete} disabled={deleting}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer">
            {deleting ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Deleting...</> : 'Delete Job'}
          </button>
        </div>
      </div>
    </div>
  );
}