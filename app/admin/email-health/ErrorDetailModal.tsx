'use client';

import { useEffect } from 'react';

interface EmailLogEntry {
  id: string;
  function_name: string;
  template: string | null;
  recipient: string;
  status: string;
  error_message: string | null;
  related_user_id: string | null;
  related_job_id: string | null;
  sent_at: string | null;
  created_at: string;
}

interface ErrorDetailModalProps {
  entry: EmailLogEntry;
  onClose: () => void;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ErrorDetailModal({ entry, onClose }: ErrorDetailModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div className="relative bg-[#111d35] border border-[#1a2b4a] rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Email Error Details</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-slate-500">Function: </span>
            <span className="text-white">{entry.function_name}</span>
          </div>
          <div>
            <span className="text-slate-500">Recipient: </span>
            <span className="text-white">{entry.recipient}</span>
          </div>
          <div>
            <span className="text-slate-500">Template: </span>
            <span className="text-white">{entry.template || 'Unknown'}</span>
          </div>
          <div>
            <span className="text-slate-500">Status: </span>
            <span className="text-red-400 font-medium">Failed</span>
          </div>
          {entry.related_user_id && (
            <div>
              <span className="text-slate-500">Related User: </span>
              <span className="text-white text-xs font-mono">{entry.related_user_id}</span>
            </div>
          )}
          {entry.related_job_id && (
            <div>
              <span className="text-slate-500">Related Job: </span>
              <span className="text-white text-xs font-mono">{entry.related_job_id}</span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Time: </span>
            <span className="text-white">{formatDate(entry.sent_at || entry.created_at)}</span>
          </div>
          <div className="bg-[#0B1933] rounded-xl p-4 border border-[#1a2b4a]">
            <p className="text-xs text-slate-400 mb-1 font-medium">Error Message</p>
            <p className="text-sm text-red-400 break-words">{entry.error_message || 'No error details'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}