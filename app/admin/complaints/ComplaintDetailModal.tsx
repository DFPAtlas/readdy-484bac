'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { StatusBadge, SeverityBadge } from './ComplaintStatusBadge';
import ComplaintTimeline from './ComplaintTimeline';

interface Complaint {
  id: string;
  complaint_id: string;
  filed_by_id: string;
  filed_by_type: string;
  filed_against_id: string | null;
  filed_against_type: string | null;
  related_job_id: string | null;
  category: string;
  severity: string;
  description: string;
  evidence_url: string | null;
  status: string;
  admin_notes: string | null;
  client_response: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  filed_by_name?: string;
  filed_against_name?: string;
  job_title?: string;
}

interface AdminInfo {
  id: string;
  email: string;
  name: string;
}

interface Props {
  complaint: Complaint;
  adminInfo: AdminInfo | null;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_OPTIONS = ['open', 'under_review', 'resolved', 'closed'];

function formatCategory(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ComplaintDetailModal({ complaint, adminInfo, onClose, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
  const [status, setStatus] = useState(complaint.status);
  const [adminNotes, setAdminNotes] = useState(complaint.admin_notes ?? '');
  const [resolutionNotes, setResolutionNotes] = useState(complaint.resolution_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [timelineKey, setTimelineKey] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const performedBy = adminInfo?.name ?? adminInfo?.email ?? 'Admin';

  const logAudit = async (entries: { action_type: string; previous_value?: string | null; new_value?: string | null }[]) => {
    if (entries.length === 0) return;
    await supabase.from('complaint_audit_trail').insert(
      entries.map(e => ({
        complaint_id: complaint.id,
        action_type: e.action_type,
        previous_value: e.previous_value ?? null,
        new_value: e.new_value ?? null,
        performed_by: performedBy,
      }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const updates: Record<string, any> = {
      status,
      admin_notes: adminNotes || null,
      resolution_notes: resolutionNotes || null,
    };
    if ((status === 'resolved' || status === 'closed') && !complaint.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase.from('complaints').update(updates).eq('id', complaint.id);

    if (!error) {
      const auditEntries: { action_type: string; previous_value?: string | null; new_value?: string | null }[] = [];

      if (status !== complaint.status) {
        auditEntries.push({
          action_type: 'status_change',
          previous_value: complaint.status,
          new_value: status,
        });
      }
      if (adminNotes !== (complaint.admin_notes ?? '')) {
        auditEntries.push({
          action_type: 'admin_note',
          new_value: adminNotes || null,
        });
      }
      if (resolutionNotes !== (complaint.resolution_notes ?? '')) {
        auditEntries.push({
          action_type: 'resolution_note',
          new_value: resolutionNotes || null,
        });
      }

      await logAudit(auditEntries);
      setTimelineKey(k => k + 1);
      showToast('Complaint updated successfully');
      onUpdated();
    } else {
      setSaveError(error.message || 'Failed to save changes');
    }

    setSaving(false);
  };

  const emailSubject = encodeURIComponent(`Re: Complaint ${complaint.complaint_id}`);
  const emailBody = encodeURIComponent(
    `Dear ${complaint.filed_by_name ?? 'User'},\n\nRegarding your complaint ${complaint.complaint_id} (${formatCategory(complaint.category)})...\n\n`
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-[#111d35] rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-[#1a2b4a]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{complaint.complaint_id}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Filed {new Date(complaint.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1a2b4a] cursor-pointer text-slate-400 hover:text-white transition-colors">
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a2b4a] px-6 flex-shrink-0">
          {(['details', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition cursor-pointer whitespace-nowrap -mb-px ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'details' ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-text-line"></i></span>
                  Details
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-time-line"></i></span>
                  Audit Trail
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 bg-[#0a0f1c]">
          {activeTab === 'details' ? (
            <div className="space-y-5">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Filed By" value={`${complaint.filed_by_name ?? 'Unknown'} (${complaint.filed_by_type})`} />
                <InfoRow label="Filed Against" value={complaint.filed_against_name ?? 'N/A'} />
                <InfoRow label="Category" value={formatCategory(complaint.category)} />
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Related Job</p>
                  {complaint.related_job_id ? (
                    <Link
                      href={`/admin/jobs?id=${complaint.related_job_id}`}
                      className="text-sm text-teal-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      {complaint.job_title ?? complaint.related_job_id.substring(0, 8)}
                      <span className="w-3 h-3 flex items-center justify-center"><i className="ri-external-link-line text-xs"></i></span>
                    </Link>
                  ) : (
                    <p className="text-sm text-white font-medium">N/A</p>
                  )}
                </div>
                {complaint.resolved_at && (
                  <InfoRow label="Resolved On" value={new Date(complaint.resolved_at).toLocaleDateString('en-GB')} />
                )}
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap bg-[#0a1628] rounded-xl p-4 border border-[#1a2b4a] leading-relaxed">
                  {complaint.description}
                </p>
              </div>

              {/* Evidence */}
              {complaint.evidence_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Evidence</p>
                  <a href={complaint.evidence_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:underline cursor-pointer font-medium">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-external-link-line"></i></div>
                    View Evidence
                  </a>
                </div>
              )}

              {/* Client Response */}
              {complaint.client_response && (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-sky-400 uppercase tracking-wide mb-2">Client Response</p>
                  <p className="text-sm text-sky-300 whitespace-pre-wrap leading-relaxed">{complaint.client_response}</p>
                </div>
              )}

              {/* Reply Action */}
              <div className="flex items-center gap-3">
                <a
                  href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sm font-medium text-sky-400 hover:bg-sky-500/20 cursor-pointer whitespace-nowrap transition-colors"
                >
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-line"></i></span>
                  Draft Email to Complainant
                </a>
              </div>

              {/* Save Error */}
              {saveError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-red-500/10 rounded-lg flex-shrink-0">
                    <i className="ri-error-warning-line text-red-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-400">Failed to save changes</p>
                    <p className="text-xs text-red-400/70 mt-0.5">{saveError}</p>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <div className="border-t border-[#1a2b4a] pt-5 space-y-4 bg-[#0a1628] rounded-2xl p-5 border border-[#1a2b4a]">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#1a2b4a] rounded-lg">
                    <i className="ri-settings-line text-slate-400"></i>
                  </div>
                  Admin Actions
                </p>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s} onClick={() => setStatus(s)} disabled={saving}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                          status === s ? 'bg-teal-500 text-white border-teal-500' : 'bg-[#111d35] text-slate-400 border-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white'
                        }`}>
                        {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                    disabled={saving}
                    placeholder="Internal notes visible to admins only..."
                    className="w-full px-3 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none bg-[#111d35] text-white placeholder-slate-500 disabled:opacity-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">{adminNotes.length}/500</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                    disabled={saving}
                    placeholder="Describe how this complaint was resolved..."
                    className="w-full px-3 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none bg-[#111d35] text-white placeholder-slate-500 disabled:opacity-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">{resolutionNotes.length}/500</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-bold text-white">Activity Timeline</p>
                  <p className="text-xs text-slate-400 mt-0.5">Every status change and admin action, newest first</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-500/20">
                  <i className="ri-history-line text-teal-400"></i>
                </div>
              </div>
              <ComplaintTimeline key={timelineKey} complaintId={complaint.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'details' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a2b4a] flex-shrink-0">
            {toast ? (
              <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line"></i>
                {toast}
              </span>
            ) : <span />}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={saving}
                className="px-5 py-2.5 border border-[#1a2b4a] text-slate-400 rounded-xl text-sm font-medium hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-500 cursor-pointer whitespace-nowrap disabled:opacity-50 shadow-sm shadow-teal-900/30 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}