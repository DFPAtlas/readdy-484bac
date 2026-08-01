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
  enrichment_status: string | null;
  enrichment_notes: string | null;
  page_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_site_name: string | null;
  metadata_text: string | null;
  last_scanned_at: string | null;
  created_at: string;
}

interface Props {
  lead: Lead;
  onClose: () => void;
  onUpdate: (updated: Lead) => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export default function LeadDrawer({ lead, onClose, onUpdate, onToast }: Props) {
  const [localLead, setLocalLead] = useState<Lead>(lead);
  const [saving, setSaving] = useState(false);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const handleMarkContacted = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('quickguard_leads')
      .update({ status: 'contacted' })
      .eq('id', lead.id);

    if (!error) {
      const updated = { ...localLead, status: 'contacted' as const };
      setLocalLead(updated);
      onUpdate(updated);
      onToast('Marked as contacted', 'success');
    } else {
      onToast('Failed to update', 'error');
    }
    setSaving(false);
  };

  const handleToggleOptOut = async () => {
    const newVal = !localLead.opt_out;
    setSaving(true);
    const { error } = await supabase
      .from('quickguard_leads')
      .update({ opt_out: newVal })
      .eq('id', lead.id);

    if (!error) {
      const updated = { ...localLead, opt_out: newVal };
      setLocalLead(updated);
      onUpdate(updated);
      onToast(newVal ? 'Lead opted out' : 'Opt-out removed', 'success');
    } else {
      onToast('Failed to update', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111d35] w-full max-w-lg h-full overflow-y-auto shadow-2xl border-l border-[#1a2b4a]">
        <div className="sticky top-0 z-10 bg-[#111d35] border-b border-[#1a2b4a] px-6 py-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white truncate pr-4">{localLead.company_name || 'Lead Details'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#0B1933] transition text-slate-400 hover:text-white cursor-pointer flex-shrink-0">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <section>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Contact</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Email</p>
                  {localLead.email ? (
                    <a href={`mailto:${localLead.email}`} className="text-sm text-teal-400 hover:text-teal-300 font-medium break-all">{localLead.email}</a>
                  ) : <p className="text-sm text-slate-500">—</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                  {localLead.phone ? (
                    <a href={`tel:${localLead.phone}`} className="text-sm text-teal-400 hover:text-teal-300 font-medium">{localLead.phone}</a>
                  ) : <p className="text-sm text-slate-500">—</p>}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Contact Page</p>
                {localLead.contact_page_url ? (
                  <a href={localLead.contact_page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-medium">
                    <i className="ri-external-link-line text-xs"></i>
                    {localLead.contact_page_url}
                  </a>
                ) : <p className="text-sm text-slate-500">—</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Decision Maker</p>
                  <p className="text-sm text-white">{localLead.decision_maker_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Website</p>
                  {localLead.website_url ? (
                    <a href={localLead.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-medium">
                      <i className="ri-external-link-line text-xs"></i>
                      Visit
                    </a>
                  ) : <p className="text-sm text-slate-500">—</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Location</p>
                  <p className="text-sm text-white">{localLead.location || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Postcode</p>
                  <p className="text-sm text-white">{localLead.postcode || '—'}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Lead Details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Score</p>
                  <p className={`text-sm font-bold ${(localLead.lead_score ?? 0) >= 80 ? 'text-emerald-400' : (localLead.lead_score ?? 0) >= 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {localLead.lead_score ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    (localLead.status || 'new') === 'contacted'
                      ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                  }`}>
                    {(localLead.status || 'new').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Email Status</p>
                  <p className="text-sm text-white capitalize">{(localLead.email_status || 'not_sent').replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Opt Out</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${localLead.opt_out ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20' : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'}`}>
                    {localLead.opt_out ? 'Opted Out' : 'Active'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Enrichment Status</p>
                <p className="text-sm text-white">{localLead.enrichment_status || '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Created</p>
                  <p className="text-sm text-white">{formatDate(localLead.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Last Scanned</p>
                  <p className="text-sm text-white">{formatDate(localLead.last_scanned_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Source Search</p>
                <p className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a]">{localLead.source_search || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Reason</p>
                <p className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] leading-relaxed whitespace-pre-wrap">{localLead.reason || '—'}</p>
              </div>
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Enrichment Data</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Page Title</p>
                <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-24 overflow-y-auto">
                  {localLead.page_title || '—'}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Meta Description</p>
                <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-24 overflow-y-auto">
                  {localLead.meta_description || '—'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">OG Title</p>
                  <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-20 overflow-y-auto">
                    {localLead.og_title || '—'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">OG Site Name</p>
                  <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-20 overflow-y-auto">
                    {localLead.og_site_name || '—'}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">OG Description</p>
                <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-24 overflow-y-auto">
                  {localLead.og_description || '—'}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Metadata Text</p>
                <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                  {localLead.metadata_text || '—'}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-0.5">Enrichment Notes</p>
                <div className="text-sm text-slate-300 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a] max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {localLead.enrichment_notes || '—'}
                </div>
              </div>
            </div>
          </section>

          <div className="pt-2 border-t border-[#1a2b4a] flex gap-2 flex-wrap">
            <button
              onClick={handleMarkContacted}
              disabled={saving || localLead.status === 'contacted'}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                localLead.status === 'contacted'
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                  : 'border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-double-line"></i>}
              </div>
              {localLead.status === 'contacted' ? 'Contacted' : 'Mark as Contacted'}
            </button>

            <button
              onClick={handleToggleOptOut}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                localLead.opt_out
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10'
                  : 'border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className={localLead.opt_out ? 'ri-checkbox-circle-line' : 'ri-forbid-2-line'}></i>}
              </div>
              {localLead.opt_out ? 'Remove Opt-out' : 'Toggle Opt-out'}
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#111d35] border-t border-[#1a2b4a] px-6 py-4 flex justify-between items-center">
          <span className="text-xs text-slate-500">ID: {localLead.id.slice(0, 8)}...</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-400 bg-[#0B1933] border border-[#1a2b4a] rounded-xl hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}