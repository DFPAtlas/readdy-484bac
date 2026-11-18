'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { batchLeadRows, leadCsvFields, maxLeadCsvBytes, parseLeadCsv } from './leadCsv';
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
  const [batches, setBatches] = useState<CsvLead[][]>([]);
  const [index, setIndex] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  const additions = results.filter(row => row.action === 'add').length;
  const updates = results.filter(row => row.action === 'update').length;
  const skipped = results.length - additions - updates;

  async function previewBatch(batch: CsvLead[]) {
    setResults([]);
    const { data, error: requestError } = await supabase.rpc('import_quickguard_leads_csv', {
      p_rows: batch,
    });
    if (requestError) throw new Error(requestError.message);
    if (!Array.isArray(data) || data.length !== batch.length) {
      throw new Error('The preview was incomplete. Preview this batch again.');
    }
    setResults(data as ImportResult[]);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary('');
    setProcessed(0);
    setIndex(0);
    setBatches([]);
    setResults([]);
    setBusy(true);
    try {
      if (file.size > maxLeadCsvBytes) throw new Error('The CSV must be 10 MB or smaller.');
      const parts = batchLeadRows(parseLeadCsv(await file.text()));
      setBatches(parts);
      await previewBatch(parts[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview the CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function retryPreview() {
    setBusy(true);
    setError('');
    try {
      await previewBatch(batches[index]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview this batch.');
    } finally {
      setBusy(false);
    }
  }

  async function importLeads() {
    setBusy(true);
    setError('');
    try {
      if (additions + updates > 0) {
        const { error: requestError } = await supabase.rpc('import_quickguard_leads_csv', {
          p_rows: batches[index],
          p_expected: results,
        });
        if (requestError) throw new Error(requestError.message);
      }
      const count = processed + results.length;
      setProcessed(count);
      const next = index + 1;
      setIndex(next);
      setResults([]);
      if (additions + updates > 0) onImported();
      if (next < batches.length) {
        await previewBatch(batches[next]);
      } else {
        setSummary(batches.length === 1
          ? `Added ${additions}, updated ${updates}, skipped ${skipped}.`
          : `Finished processing all ${count} rows in ${batches.length} batches.`);
      }
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Could not finish this batch. Preview it again.');
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
            void selectFile(event);
            event.currentTarget.value = '';
          }}
        />

        {batches.length > 1 && index < batches.length && (
          <p className="mt-3 text-sm">Batch {index + 1} of {batches.length} · {processed} rows processed. Review each batch before importing it.</p>
        )}
        {error && !busy && batches[index] && (
          <button type="button" className={buttonClass} onClick={() => void retryPreview()}>Preview this batch again</button>
        )}
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
                disabled={busy}
                onClick={() => void importLeads()}
                className={buttonClass + ' bg-teal-500 text-slate-950 hover:bg-teal-400'}
              >
                {additions + updates ? `Import ${additions + updates} leads` : 'Skip this batch'}
              </button>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
