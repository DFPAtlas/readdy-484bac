'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { readContractSettings, saveContractVersion, setDefaultContract, type ContractSettings } from '@/lib/client-contracts';
import { useMessageOwner } from '@/hooks/useMessageOwner';
export default function ClientContractSettings({ userId, clientId }: { userId: string; clientId: string }) {
  const owner = useMessageOwner();const [settings, setSettings] = useState<ContractSettings | null>(null);const [title, setTitle] = useState('');const [terms, setTerms] = useState('');const [error, setError] = useState('');const [busy, setBusy] = useState(false);const [attempt, setAttempt] = useState<{ id: string; title: string; terms: string; expected: string | null } | null>(null);
  const epoch = useRef(0);const lock = useRef(false);const [reload, setReload] = useState(0);
  const ready = owner.ready && owner.id === userId && !owner.error;
  useEffect(() => { const version = ++epoch.current;setSettings(null);setAttempt(null);setTitle('');setTerms('');setError('');setBusy(false);lock.current = false;
    if (ready) void readContractSettings(userId, clientId).then(value => { if (epoch.current === version) setSettings(value); }).catch(() => { if (epoch.current === version) setError('Contract settings could not be loaded. Retry.'); });
    return () => { epoch.current = version + 1; };
  }, [userId, clientId, owner.revision, ready, reload]);
  const run = async (request: () => Promise<ContractSettings>) => { if (lock.current || !ready || !settings?.allowed) return;const version = epoch.current;lock.current = true;setBusy(true);setError('');try { const result = await request();if (version === epoch.current) { setSettings(result);setAttempt(null);setTitle('');setTerms(''); } } catch { if (version === epoch.current) setError('Save could not be confirmed. Retry the same request or reload the saved versions.'); } finally { if (version === epoch.current) { lock.current = false;setBusy(false); } } };
  if (!ready) return <p role="status">Checking contract access…</p>;
  return <section className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-6 mt-6"><h2 className="text-lg font-bold">Company contract terms</h2><p className="text-sm text-slate-500 my-2">Save a version of your terms and make it the default for new jobs. Guards must explicitly accept the job’s attached version before assignment. Changing your default leaves existing job terms unchanged.</p>
    <button type="button" className="underline text-teal-500 my-2" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload contract settings</button>
    {error && <p role="alert">{error}</p>}{!settings && !error && <p role="status">Loading contract settings…</p>}
    {settings && !settings.allowed && <Link href="/upgrade?reason=client.custom_contracts">Custom contract management requires Client Enterprise.</Link>}
    {settings && <ul>{settings.templates.map(template => <li className="border rounded-lg p-3 my-2" key={template.id}><strong>{template.title}</strong><span className="ml-3 text-sm">{settings.default_template_id === template.id ? 'Default for new jobs' : 'Saved version'}</span><details><summary>Read terms</summary><p className="whitespace-pre-wrap break-words">{template.terms}</p></details><button type="button" disabled={busy || !ready || !settings.allowed || !!attempt || settings.default_template_id === template.id} className="text-teal-500 underline" onClick={() => void run(() => setDefaultContract(userId, clientId, template.id, settings.default_template_id))}>Use for new jobs</button></li>)}</ul>}
    {settings?.allowed && <form onSubmit={event => { event.preventDefault();const intent = attempt || { id: crypto.randomUUID(), title: title.trim(), terms, expected: settings.default_template_id };setAttempt(intent);void run(() => saveContractVersion(userId, clientId, intent)); }}>
      <fieldset disabled={busy || !ready || !!attempt} className="space-y-3 mt-4"><label className="block">Contract title<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} className="block w-full rounded border p-2 bg-transparent" /></label>
        <label className="block">Upload a plain-text contract (.txt)<input type="file" accept=".txt,text/plain" onChange={async event => { const file = event.target.files?.[0];event.target.value = '';if (!file) return;const version = epoch.current;try { if (file.size > 240000) throw new Error();const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());if (text.length > 60000 || !text.trim() || text.includes('\0')) throw new Error();if (version === epoch.current && !lock.current) { setTerms(text);setError(''); } } catch { if (version === epoch.current) setError('Choose a UTF-8 text file with 1–60,000 characters.'); } }} /></label>
        <label className="block">Contract terms<textarea required maxLength={60000} rows={10} value={terms} onChange={event => setTerms(event.target.value)} className="block w-full rounded border p-2 bg-transparent" /></label>
      </fieldset><button type="submit" disabled={busy || !ready || !title.trim() || !terms.trim()} className="rounded bg-teal-500 text-white px-4 py-2 my-3">{busy ? 'Saving…' : attempt ? 'Retry save' : 'Save version and use for new jobs'}</button>
    </form>}
    {settings?.default_template_id && settings.allowed && <button type="button" disabled={busy || !ready || !!attempt} className="underline ml-3" onClick={() => void run(() => setDefaultContract(userId, clientId, null, settings.default_template_id))}>Stop attaching terms to new jobs</button>}
  </section>;
}
