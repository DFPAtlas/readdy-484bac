'use client';
import { useEffect, useRef, useState } from 'react';
import { importBulkJobCsv, bulkJobCsvTemplate, BULK_JOB_CSV_MAX_BYTES, type BulkCsvJob } from '@/lib/bulk-job-csv';
export default function BulkCsvImport({ disabled, onImport }: { disabled: boolean; onImport: (rows: BulkCsvJob[]) => void }) {
  const [message, setMessage] = useState('');const [reading, setReading] = useState(false);const active = useRef(true);const readingRef = useRef(false);
  useEffect(() => { active.current = true;return () => { active.current = false; }; }, []);
  return <section className="rounded-xl border border-[#1e2d4d] bg-[#111d35] p-5 mb-5"><h2 className="font-bold text-white">Import jobs from CSV</h2>
    <p className="text-sm text-slate-400 my-2">Import up to 100 rows (1MB), review them in the grid, then choose Post All. Importing never posts a job. Dates: YYYY-MM-DD; times: HH:MM. Shared settings apply to imported jobs.</p>
    <button type="button" disabled={disabled || reading} className="text-teal-400 underline mr-4" onClick={() => {
      const url = URL.createObjectURL(new Blob([bulkJobCsvTemplate()], { type: 'text/csv;charset=utf-8' }));const link = document.createElement('a');link.href = url;link.download = 'quickguard-bulk-jobs-template.csv';link.click();setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Download CSV template</button>
    <label className="text-slate-300">Choose CSV<input aria-label="Import jobs CSV" type="file" accept=".csv,text/csv" disabled={disabled || reading} className="ml-3" onChange={async event => {
      const file = event.target.files?.[0];event.target.value = '';if (!file || readingRef.current || disabled) return;
      readingRef.current = true;setReading(true);setMessage('');
      try { if (!file.size || file.size > BULK_JOB_CSV_MAX_BYTES) throw new Error('Choose a CSV up to 1MB.');const source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());const rows = importBulkJobCsv(source);if (active.current) { onImport(rows);setMessage(`${rows.length} jobs imported for review. Nothing has been posted.`); } }
      catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : 'CSV could not be imported.'); }
      finally { readingRef.current = false;if (active.current) setReading(false); }
    }} /></label><p role="status" className="text-sm text-slate-300 mt-3">{reading ? 'Reading CSV…' : message}</p>
    <p className="text-xs text-slate-400 mt-2">securityType: door-supervisor, event-security, retail-security, close-protection, cctv-operator, security-guard, mobile-patrol, key-holding or dog-handler.</p>
  </section>;
}
