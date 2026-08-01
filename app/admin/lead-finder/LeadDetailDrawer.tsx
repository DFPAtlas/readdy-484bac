'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Lead {
  id: string;
  company_name: string | null;
  sector: string | null;
  website_url: string | null;
  contact_page_url: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  postcode: string | null;
  decision_maker_name: string | null;
  source_search: string | null;
  lead_score: number | null;
  reason: string | null;
  status: string | null;
  email_status: string | null;
  opt_out: boolean | null;
  last_scanned_at: string | null;
  created_at: string;
}

interface Props {
  lead: Lead;
  onClose: () => void;
  onUpdated: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function LeadDetailDrawer({ lead, onClose, onUpdated, showToast }: Props) {
  const [status, setStatus] = useState(lead.status || 'new');
  const [optOut, setOptOut] = useState(lead.opt_out || false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statusOptions = ['new', 'contacted', 'not_suitable', 'converted', 'archived'];

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(newStatus);
    const { error } = await supabase
      .from('quickguard_leads')
      .update({ status: newStatus })
      .eq('id', lead.id);

    if (error) {
      showToast(`Status change failed: ${error.message}`, 'error');
    } else {
      setStatus(newStatus);
      showToast('Status updated', 'success');
      onUpdated();
    }
    setActionLoading(null);
  };

  const handleOptOutToggle = async () => {
    const newVal = !optOut;
    setActionLoading('optout');
    const { error } = await supabase
      .from('quickguard_leads')
      .update({ opt_out: newVal })
      .eq('id', lead.id);

    if (error) {
      showToast(`Opt-out toggle failed: ${error.message}`, 'error');
    } else {
      setOptOut(newVal);
      showToast(newVal ? 'Lead opted out' : 'Lead re-enabled', 'success');
      onUpdated();
    }
    setActionLoading(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('quickguard_leads')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id || null })
      .eq('id', lead.id);

    if (error) {
      showToast(`Delete failed: ${error.message}`, 'error');
      setDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      showToast('Lead deleted', 'success');
      setDeleting(false);
      setShowDeleteConfirm(false);
      onUpdated();
      onClose();
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusActiveCls: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    not_suitable: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    converted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    archived: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };

  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0B1933] border-l border-[#1a2b4a] w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#0B1933]/90 backdrop-blur-md border-b border-[#1a2b4a] px-6 py-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white truncate pr-4">{lead.company_name || 'Lead Details'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] transition text-slate-400 hover:text-slate-200 cursor-pointer flex-shrink-0">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Company</p>
              <p className="text-sm font-semibold text-slate-100">{lead.company_name || '\u2014'}</p>
            </div>
            <div>
              <p className={labelCls}>Sector</p>
              <p className="text-sm text-slate-300">{lead.sector || '\u2014'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Location</p>
              <p className="text-sm text-slate-300">{lead.location || '\u2014'}</p>
            </div>
            <div>
              <p className={labelCls}>Postcode</p>
              <p className="text-sm text-slate-300">{lead.postcode || '\u2014'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Decision Maker</p>
              <p className="text-sm text-slate-300">{lead.decision_maker_name || '\u2014'}</p>
            </div>
            <div>
              <p className={labelCls}>Lead Score</p>
              <p className={`text-sm font-bold ${(lead.lead_score ?? 0) >= 80 ? 'text-emerald-400' : (lead.lead_score ?? 0) >= 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                {lead.lead_score ?? '\u2014'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Email</p>
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="text-sm text-teal-400 hover:text-teal-300 font-medium break-all">{lead.email}</a>
              ) : <p className="text-sm text-slate-500">\u2014</p>}
            </div>
            <div>
              <p className={labelCls}>Phone</p>
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="text-sm text-teal-400 hover:text-teal-300 font-medium">{lead.phone}</a>
              ) : <p className="text-sm text-slate-500">\u2014</p>}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className={labelCls}>Website</p>
              {lead.website_url ? (
                <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-medium">
                  <i className="ri-external-link-line text-xs"></i>
                  {lead.website_url}
                </a>
              ) : <p className="text-sm text-slate-500">\u2014</p>}
            </div>
            <div>
              <p className={labelCls}>Contact Page</p>
              {lead.contact_page_url ? (
                <a href={lead.contact_page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-medium">
                  <i className="ri-external-link-line text-xs"></i>
                  {lead.contact_page_url}
                </a>
              ) : <p className="text-sm text-slate-500">\u2014</p>}
            </div>
          </div>

          <div>
            <p className={labelCls}>Source Search</p>
            <p className="text-sm text-slate-300 bg-[#111d35] rounded-xl p-3 border border-[#1a2b4a]">{lead.source_search || '\u2014'}</p>
          </div>

          <div>
            <p className={labelCls}>AI Reason</p>
            <p className="text-sm text-slate-300 bg-[#111d35] rounded-xl p-3 border border-[#1a2b4a] leading-relaxed whitespace-pre-wrap">{lead.reason || '\u2014'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Email Status</p>
              <p className="text-sm text-slate-300 capitalize">{(lead.email_status || 'not_sent').replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className={labelCls}>Opt Out</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${optOut ? 'bg-red-500/10 text-red-400 ring-red-500/20' : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'}`}>
                {optOut ? 'Opted Out' : 'Active'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Last Scanned</p>
              <p className="text-sm text-slate-300">{formatDate(lead.last_scanned_at)}</p>
            </div>
            <div>
              <p className={labelCls}>Created</p>
              <p className="text-sm text-slate-300">{formatDate(lead.created_at)}</p>
            </div>
          </div>

          <div className="pt-2">
            <p className={labelCls}>Status</p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(opt => (
                <button
                  key={opt}
                  disabled={actionLoading !== null}
                  onClick={() => handleStatusChange(opt)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                    status === opt
                      ? (statusActiveCls[opt] || '')
                      : 'bg-transparent border-[#1a2b4a] text-slate-500 hover:text-slate-300 hover:border-[#243a5e]'
                  } disabled:opacity-60`}
                >
                  {actionLoading === opt ? (
                    <span className="flex items-center gap-1.5">
                      <i className="ri-loader-4-line animate-spin text-xs"></i>
                      Saving...
                    </span>
                  ) : (
                    opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1 border-t border-[#1a2b4a] space-y-2">
            <div className="flex gap-2">
              {lead.website_url && (
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-window-line"></i>
                  </div>
                  Website
                </a>
              )}
              {lead.contact_page_url && (
                <a
                  href={lead.contact_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-contacts-line"></i>
                  </div>
                  Contact Page
                </a>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleOptOutToggle}
                disabled={actionLoading !== null}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                  optOut
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {actionLoading === 'optout' ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className={optOut ? 'ri-checkbox-circle-line' : 'ri-forbid-2-line'}></i>
                  )}
                </div>
                {optOut ? 'Re-enable' : 'Opt Out'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-delete-bin-line"></i>
                </div>
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1a2b4a] bg-[#0a1628]/50 flex justify-between items-center">
          <span className="text-xs text-slate-600">ID: {lead.id.slice(0, 8)}...</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-400 bg-[#111d35] border border-[#1a2b4a] rounded-xl hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-[#111d35] border border-[#1a2b4a] rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-2xl text-red-400"></i>
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Delete this lead?</h3>
            <p className="text-sm text-slate-400 text-center mb-6">
              This will soft-delete <span className="font-semibold text-slate-300">{lead.company_name || 'this lead'}</span>. It can be restored later by an admin.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 rounded-xl text-sm font-semibold text-white hover:bg-red-500 transition cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-sm"></i>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}