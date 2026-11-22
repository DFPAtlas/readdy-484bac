'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createReportPdf } from '@/lib/report-pdf';
import { guardStatement, statementMonth, type StatementPayment } from '@/lib/guard-statement';

export default function GuardStatementDownload({ payments, ownerId }: { payments: readonly StatementPayment[]; ownerId: string | null }) {
  const [month, setMonth] = useState(() => statementMonth(new Date().toISOString()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false), generation = useRef(0);
  useEffect(() => {
    const state = generation;++state.current;setMessage('');return () => { ++state.current; };
  }, [ownerId]);
  async function download() {
    if (!ownerId || lock.current) return;
    const version = generation.current;
    lock.current = true;setBusy(true);setMessage('');
    try {
      const report = guardStatement(payments, month);
      const before = await supabase.auth.getUser();
      if (before.error || before.data.user?.id !== ownerId) throw new Error('Please sign in again before exporting.');
      const blob = await createReportPdf(report);
      const after = await supabase.auth.getUser();
      if (version !== generation.current) return;
      if (after.error || after.data.user?.id !== ownerId) throw new Error('Your account changed. Reload before exporting.');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;link.download = `quickguard-statement-${month}.pdf`;link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('PDF statement downloaded.');
    } catch (cause) { if (version === generation.current) setMessage(cause instanceof Error ? cause.message : 'PDF export failed. Please retry.'); }
    finally { lock.current = false;if (version === generation.current) setBusy(false); }
  }
  return <div className="rounded-xl border border-[#1e2d4d] bg-[#162036] p-4">
    <label className="block text-sm text-slate-300">Statement month <input aria-label="Statement month" type="month" value={month} onChange={e => setMonth(e.target.value)} className="ml-2 rounded bg-[#111d35] p-2" /></label>
    <button type="button" onClick={() => void download()} disabled={busy || !ownerId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)} className="mt-3 rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Creating PDF…' : 'Download PDF statement'}</button>
    <p className="mt-2 text-xs text-slate-400">Monthly recorded payments, fees and transfer status. Bank arrival is shown separately in bank deposits.</p>
    {message && <p role="status" className="mt-2 text-sm text-slate-200">{message}</p>}
  </div>;
}
