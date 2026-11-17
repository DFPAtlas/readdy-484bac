'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { leadCsvFields, maxLeadCsvBytes, parseLeadCsv } from './leadCsv';
import type { CsvLead } from './leadCsv';

interface ImportResult {
  row: number;
  action: 'add' | 'update' | 'skip';
  id: string | null;
  message: string | null;
}

const template = 'data:text/csv;charset=utf-8,' + encodeURIComponent(leadCsvFields.join(',') + '\r\n');
const buttonClass = 'rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50';

export default function LeadCsvImport({ onImported }: { onImported: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<CsvLead[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  const additions = results.filter(row => row.action === 'add').length;
  const updates = results.filter(row => row.action === 'update').length;
  const skipped = results.length - additions - updates;

  async function preview(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary('');
    setRows([]);
    setResults([]);
    setBusy(true);

    try {
      if (file.size > maxLeadCsvBytes) throw new Error('The CSV must be 1 MB or smaller.');
      const parsed = parseLeadCsv(await file.text());
      const { data, error: requestError } = await supabase.rpc('import_quickguard_leads_csv', {
        p_rows: parsed,
      });
      if (requestError) throw new Error(requestError.message);
      setRows(parsed);
      setResults(data as ImportResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview the CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function importLeads() {
    setBusy(true);
    setError('');
    try {
      const { error: requestError } = await supabase.rpc('import_quickguard_leads_csv', {
        p_rows: rows,
        p_expected: results,
      });
      if (requestError) throw new Error(requestError.message);
      setSummary(`Added ${additions}, updated ${updates}, skipped ${skipped}.`);
      setRows([]);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the CSV.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={buttonClass + ' bg-teal-500 text-slate-950 hover:bg-teal-400'}
      >
        Upload CSV
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="lead-csv-title"
        onCancel={event => { if (busy) event.preventDefault(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-6 text-slate-200 backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="lead-csv-title" className="text-lg font-semibold text-white">Upload leads CSV</h2>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        <p className="my-3 text-sm text-slate-400">
          Use a lead ID or the existing website URL to match updates. Rows without a website can
          match by company name and the same email and phone details. Blank cells keep saved values.
        </p>
        <a className="text-sm text-teal-400 underline" href={template} download="quickguard-leads.csv">
          Download CSV template
        </a>
        <label className="mt-4 block text-sm font-medium" htmlFor="lead-csv-file">CSV file</label>
        <input
          id="lead-csv-file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="mt-2 block w-full text-sm"
          onChange={event => {
            void preview(event);
            event.currentTarget.value = '';
          }}
        />

        {busy && <p role="status" className="mt-4 text-sm">Processing CSV…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        {summary && <p role="status" className="mt-4 text-sm text-teal-300">{summary}</p>}

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {!summary && <p className="text-sm">{additions} to add, {updates} to update, {skipped} to skip</p>}
            <div className="max-h-60 overflow-auto rounded-xl border border-[#1a2b4a]">
              <table className="w-full text-left text-sm">
                <thead><tr><th className="p-2">CSV row</th><th className="p-2">Result</th></tr></thead>
                <tbody>
                  {results.map(row => (
                    <tr key={row.row} className="border-t border-[#1a2b4a]">
                      <td className="p-2">{row.row}</td>
                      <td className="p-2">{row.message ?? (row.action === 'add' ? 'New lead' : 'Existing lead')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!summary && (
              <button
                type="button"
                disabled={busy || additions + updates === 0}
                onClick={() => void importLeads()}
                className={buttonClass + ' bg-teal-500 text-slate-950 hover:bg-teal-400'}
              >
                Import {additions + updates} leads
              </button>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
