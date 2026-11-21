'use client';
import { useEffect, useRef, useState } from 'react';
import { useMessageOwner } from '@/hooks/useMessageOwner';
import { readJobContract, acceptJobContract, type JobContractDetail } from '@/lib/client-contracts';
export default function JobContractPanel({ jobId }: { jobId: string }) {
  const owner = useMessageOwner();const [detail, setDetail] = useState<JobContractDetail | null>(null);const [agreed, setAgreed] = useState(false);const [busy, setBusy] = useState(false);const [error, setError] = useState('');const [reload, setReload] = useState(0);const epoch = useRef(0);const lock = useRef(false);const loadedFor = useRef({ userId: '', revision: -1, jobId: '' });
  useEffect(() => { const version = ++epoch.current;setDetail(null);setAgreed(false);setError('');setBusy(false);lock.current = false;
    if (owner.ready && owner.id && !owner.error) void readJobContract(owner.id, jobId).then(result => { if (version === epoch.current) { loadedFor.current = { userId: owner.id || '', revision: owner.revision, jobId };setDetail(result); } }).catch(() => { if (version === epoch.current) setError('Job contract could not be loaded. Retry before accepting an assignment.'); });
    return () => { epoch.current = version + 1; };
  }, [jobId, owner.id, owner.ready, owner.error, owner.revision, reload]);
  const visible = owner.ready && !owner.error && loadedFor.current.userId === owner.id && loadedFor.current.revision === owner.revision && loadedFor.current.jobId === jobId;
  if (!visible && !error) return <p role="status">Loading job contract…</p>;
  if (detail && !detail.contract) return null;
  return <section className="rounded-xl border border-[#1e2d4d] bg-[#111d35] p-5 mb-5 text-slate-300"><h2 className="font-bold text-white">Job contract</h2>{!detail && !error && <p role="status">Loading contract…</p>}{error && <p role="alert">{error}</p>}{error && <button type="button" onClick={() => setReload(value => value + 1)} className="underline">Retry contract</button>}
    {visible && detail?.contract && <><h3 className="font-semibold my-2">{detail.contract.title}</h3><details><summary>Read the attached terms</summary><p className="whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-3">{detail.contract.terms}</p></details><p className="text-xs text-slate-400 my-3">These terms are fixed for this job. Version: {detail.contract.content_sha256.slice(0, 12)}</p>
      {!detail.can_accept && detail.acceptances?.length > 0 && <div className="my-3"><h3 className="font-semibold">Acceptance records</h3><ul>{detail.acceptances.map(receipt => <li key={receipt.guard_id}>{receipt.guard_name} — accepted {new Date(receipt.accepted_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })} (UK)</li>)}</ul></div>}
      {detail.contract.accepted_at ? <p role="status">Accepted on {new Date(detail.contract.accepted_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })} (UK)</p> : detail.can_accept ? <><label className="block my-3"><input type="checkbox" checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)} /> I have read and agree to this job’s attached contract terms.</label><button type="button" disabled={!agreed || busy || !owner.id} className="rounded bg-teal-500 px-4 py-2 text-white disabled:opacity-50" onClick={async () => {
        if (lock.current || !agreed || !owner.id || !detail.contract) return;const version = epoch.current;lock.current = true;setBusy(true);setError('');
        try { const result = await acceptJobContract(owner.id, jobId, detail.contract.content_sha256);if (version === epoch.current) { setDetail(result);setAgreed(false); } } catch { if (version === epoch.current) setError('Acceptance could not be confirmed. Reload the contract before retrying.'); } finally { if (version === epoch.current) { lock.current = false;setBusy(false); } }
      }}>{busy ? 'Recording acceptance…' : 'Accept job contract'}</button></> : <p>Guards must accept these terms before they can be assigned.</p>}
    </>}
  </section>;
}
