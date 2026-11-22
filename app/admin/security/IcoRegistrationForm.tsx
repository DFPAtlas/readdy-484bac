'use client';

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import type { ComplianceRecord } from './SecuritySOCClient';

interface Props {
  item: ComplianceRecord;
  onCancel: () => void;
  onSaved: () => void;
}

export default function IcoRegistrationForm({ item, onCancel, onSaved }: Props) {
  const [reference, setReference] = useState(item.evidence_reference || '');
  const [renewalDate, setRenewalDate] = useState(
    item.renewal_due_at ? new Date(item.renewal_due_at).toISOString().slice(0, 10) : ''
  );
  const [notes, setNotes] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reference.trim()) {
      setError('Enter the ICO registration reference.');
      return;
    }
    if (!renewalDate) {
      setError('Enter the data protection fee renewal date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('security-dashboard', {
        body: {
          action: 'update_compliance_record',
          key: item.key,
          evidence_reference: reference.trim(),
          renewal_due_at: `${renewalDate}T00:00:00.000Z`,
          notes: notes.trim(),
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'The compliance record could not be saved');
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'The compliance record could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-[#0f1d33] border border-[#1a2b4a] rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <i className="ri-government-line text-cyan-400 text-sm"></i>
        <p className="text-xs font-medium text-slate-200">ICO registration evidence</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="ico-reference" className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Registration reference</label>
          <input
            id="ico-reference"
            name="reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. ZA123456"
            className="w-full box-border px-2.5 py-1.5 text-xs rounded-md bg-[#0a1628] border border-[#1a2b4a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="ico-renewal" className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Fee renewal date</label>
          <input
            id="ico-renewal"
            name="renewal_date"
            type="date"
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
            className="w-full box-border px-2.5 py-1.5 text-xs rounded-md bg-[#0a1628] border border-[#1a2b4a] text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor="ico-notes" className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Evidence notes</label>
        <textarea
          id="ico-notes"
          name="notes"
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full box-border px-2.5 py-1.5 text-xs rounded-md bg-[#0a1628] border border-[#1a2b4a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
        <p className="text-[10px] text-slate-600 mt-1">{notes.length}/500 characters</p>
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-red-400 flex items-start gap-1">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
          {saving ? 'Saving…' : 'Save evidence'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#111d35] border border-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer whitespace-nowrap"
        >
          Cancel
        </button>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        The item is marked complete once a reference and a future renewal date are recorded.
      </p>
    </form>
  );
}