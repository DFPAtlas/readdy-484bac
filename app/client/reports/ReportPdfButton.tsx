'use client';
import { useEffect, useRef, useState } from 'react';
import { createReportPdf, type PdfReport } from '@/lib/report-pdf';
export default function ReportPdfButton({ report, filename, disabled, onToast }: { report: () => PdfReport; filename: string; disabled: boolean; onToast: (message: string) => void }) {
  const [busy, setBusy] = useState(false);const lock = useRef(false);const mounted = useRef(true);
  useEffect(() => { mounted.current = true;return () => { mounted.current = false; }; }, []);
  return <button type="button" aria-label="Download report PDF" disabled={disabled || busy} className="rounded-lg border border-[#1e2d4d] bg-[#162036] px-4 py-2 text-sm font-semibold text-slate-300 disabled:opacity-50" onClick={async () => {
    if (lock.current || disabled) return;lock.current = true;setBusy(true);
    try { const selected = report();if (!selected.rows.length) throw new Error('No records to export.');const blob = await createReportPdf(selected);if (!mounted.current) return;const url = URL.createObjectURL(blob);const link = document.createElement('a');link.href = url;link.download = filename + '.pdf';link.click();setTimeout(() => URL.revokeObjectURL(url), 1000);onToast(`${selected.rows.length} records exported to PDF`); }
    catch { if (mounted.current) onToast('PDF export failed. Please retry.'); }
    finally { lock.current = false;if (mounted.current) setBusy(false); }
  }}>{busy ? 'Creating PDF…' : 'PDF'}</button>;
}
