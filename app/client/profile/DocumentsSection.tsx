"use client";
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientDocument, ClientDocumentDraft, ClientDocumentError, CLIENT_DOCUMENT_MAX_BYTES, CLIENT_DOCUMENT_TYPES, saveClientDocument, deleteClientDocument, downloadClientDocument } from '@/lib/client-documents';
import { documentFileType } from '@/lib/client-document-rules';
import type { ClientDocumentsState } from '@/hooks/useClientDocuments';
interface Props {
  clientId: string; userId: string; state: ClientDocumentsState; onReload: () => void;
  onSaved: (document: ClientDocument) => void; onDeleted: (id: string) => void;
  onMessage: (type: 'success' | 'error', text: string) => void;
}
const labels: Record<string,string> = { insurance: 'Insurance Document', purchase_order: 'Purchase Order', site_instructions: 'Site Instructions', authorisation_letter: 'Authorisation Letter', contract: 'Contract', other: 'Other' };
const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-[#1e2d4d] p-2 text-sm bg-white dark:bg-[#111d35]';
export default function DocumentsSection({ clientId, userId, state, onReload, onSaved, onDeleted, onMessage }: Props) {
  const [draft,setDraft] = useState<ClientDocumentDraft | null>(null);
  const [showForm,setShowForm] = useState(false), [attempted,setAttempted] = useState(false);
  const [details,setDetails] = useState({ document_type: 'insurance', description: '', expiry_date: '' });
  const [action,setAction] = useState(''), [error,setError] = useState('');
  const [retired,setRetired] = useState(false);
  const mounted = useRef(false), lifetime = useRef(0), operation = useRef(0), busy = useRef(false), scope = useRef(clientId);
  const urls = useRef(new Set<string>()); scope.current = clientId;
  useEffect(() => {
    mounted.current = true; busy.current = false;
    setDraft(null); setShowForm(false); setAttempted(false); setError(''); setAction(''); setRetired(false);
    const activeUrls = urls.current;
    const retire = () => { lifetime.current++; operation.current++; busy.current = false; for (const url of activeUrls) URL.revokeObjectURL(url); activeUrls.clear(); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event,session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user?.id !== userId)) {
        retire(); setRetired(true); setDraft(null); setShowForm(false); setAttempted(false); setError(''); setAction('');
      }
    });
    return () => { mounted.current = false; retire(); subscription.unsubscribe(); };
  },[clientId,userId]);
  const unavailable = retired || state.status !== 'ready' || state.documents.some(d => d.client_id !== clientId);
  const start = (name: string) => {
    if (busy.current || unavailable) return null;
    busy.current = true; setAction(name); setError('');
    const token = ++operation.current, epoch = lifetime.current;
    return { token, current: () => mounted.current && lifetime.current === epoch && operation.current === token && scope.current === clientId };
  };
  const finish = (run: { token: number }) => { if (operation.current === run.token) { busy.current = false; if (mounted.current && scope.current === clientId) setAction(''); } };
  const fail = (e: unknown) => { const message = e instanceof ClientDocumentError ? e.message : 'The document request could not be confirmed. Keep your file and retry, or reload the list.'; setError(message); onMessage('error',message); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!draft) { setError('Choose a file first.'); return; }
    const run = start('save'); if (!run) return;
    setAttempted(true);
    try {
      const document = await saveClientDocument(supabase,clientId,{ ...draft,...details },run.current);
      if (!run.current()) return;
      onSaved(document); setDraft(null); setShowForm(false); setAttempted(false); onMessage('success','Document saved.');
    } catch (e) { if (run.current()) fail(e); } finally { finish(run); }
  };
  const discard = async () => {
    if (busy.current) return;
    if (!attempted || !draft) { setShowForm(false); setDraft(null); setError(''); return; }
    if (!confirm('Discard this upload and delete any copy saved by the previous attempt?')) return;
    const run = start('discard'); if (!run) return;
    try { await deleteClientDocument(supabase,clientId,draft.id,run.current); if (run.current()) { onDeleted(draft.id); setDraft(null); setShowForm(false); setAttempted(false); } }
    catch (e) { if (run.current()) fail(e); } finally { finish(run); }
  };
  const remove = async (id: string) => {
    if (busy.current || unavailable || !state.documents.some(d => d.id === id && d.client_id === clientId) || !confirm('Delete this document and its stored file?')) return;
    const run = start('delete:'+id); if (!run) return;
    try { await deleteClientDocument(supabase,clientId,id,run.current); if (run.current()) { onDeleted(id); if (draft?.id === id) { setDraft(null); setShowForm(false); setAttempted(false); } onMessage('success','Document and stored file deleted.'); } }
    catch (e) { if (run.current()) fail(e); } finally { finish(run); }
  };
  const download = async (document: ClientDocument) => {
    const run = start('download:'+document.id); if (!run) return;
    try {
      const blob = await downloadClientDocument(supabase,clientId,document.id,run.current); if (!run.current()) return;
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const link = window.document.createElement('a'); link.href = url; link.download = document.file_name; window.document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); },1000);
    } catch (e) { if (run.current()) fail(e); } finally { finish(run); }
  };
  if (retired) return <div role="alert">Your account changed. Reload your profile to manage documents.</div>;
  return <section className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
    <div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="text-lg font-bold">Documents</h2><p className="text-sm text-slate-500">Private company documents. Downloads require your signed-in account.</p></div>
      <button type="button" disabled={!!action || unavailable || showForm} onClick={() => { if (busy.current || unavailable || showForm) return; setDetails({ document_type: 'insurance', description: '', expiry_date: '' }); setAttempted(false); setDraft(null); setError(''); setShowForm(true); }} className="rounded-lg bg-teal-500 px-4 py-2 text-white disabled:opacity-50">Upload</button></div>
    <button type="button" disabled={!!action || state.status === 'loading'} className="mb-4 text-teal-500 underline disabled:opacity-50" onClick={() => { if (!busy.current) onReload(); }}>Reload documents</button>
    {state.status === 'loading' && <p role="status">Loading documents…</p>}
    {state.status === 'error' && <div role="alert">Documents could not be loaded.<button type="button" className="ml-3 underline" onClick={onReload}>Retry loading documents</button></div>}
    {error && <p role="alert" className="mb-4 text-red-500">{error}</p>}
    {showForm && <form onSubmit={submit} className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-[#162036]">
      <h3 className="font-semibold mb-3">Upload Document</h3>
      <fieldset disabled={!!action || attempted || unavailable} className="space-y-3">
        <div><label htmlFor="client-document-file">File</label><input id="client-document-file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className={inputClass} onChange={e => {
          if (busy.current || attempted || unavailable) return;
          const file = e.target.files?.[0]; if (!file) return;
          try { documentFileType(file.name,file.type); if (!file.size || file.size > CLIENT_DOCUMENT_MAX_BYTES) throw new Error('Choose a file up to 10MB.'); setDraft({ id: crypto.randomUUID(), file,...details }); setError(''); }
          catch (e) { setError(e instanceof Error ? e.message : 'Choose a supported file.'); }
        }} /><p className="text-xs text-slate-500">Up to 10MB. PDF, Word, PNG or JPEG. The file uploads when you save.</p></div>
        <div><label htmlFor="client-document-type">Document Type</label><select id="client-document-type" className={inputClass} value={details.document_type} onChange={e => setDetails(old => ({ ...old, document_type: e.target.value }))}>{CLIENT_DOCUMENT_TYPES.map(type => <option key={type} value={type}>{labels[type]}</option>)}</select></div>
        <div><label htmlFor="client-document-expiry">Expiry Date (optional)</label><input id="client-document-expiry" type="date" className={inputClass} value={details.expiry_date} onChange={e => setDetails(old => ({ ...old, expiry_date: e.target.value }))} /></div>
        <div><label htmlFor="client-document-description">Description (optional)</label><input id="client-document-description" className={inputClass} maxLength={4000} value={details.description} onChange={e => setDetails(old => ({ ...old, description: e.target.value }))} /></div>
      </fieldset>
      {draft && <p className="my-3 text-sm">Selected: {draft.file.name} ({draft.file.size.toLocaleString('en-GB')} bytes)</p>}
      {attempted && <p className="my-3 text-sm">Keep this file and these details for Retry. Discard upload removes any copy saved by this attempt.</p>}
      <div className="flex gap-3 mt-4"><button type="submit" disabled={!!action || unavailable || !draft} className="rounded-lg bg-teal-500 text-white px-4 py-2 disabled:opacity-50">{action === 'save' ? 'Saving…' : attempted ? 'Retry save' : 'Save Document'}</button><button type="button" onClick={() => void discard()} disabled={!!action} className="underline">{attempted ? 'Discard upload' : 'Cancel'}</button></div>
    </form>}
    {!unavailable && (state.documents.length === 0 ? <p className="py-8 text-center text-slate-500">No documents uploaded</p> : <ul className="space-y-3">{state.documents.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#162036]">
      <div><p className="font-semibold break-all">{document.file_name}</p><p className="text-xs text-slate-500">{labels[document.document_type]} · {document.file_size.toLocaleString('en-GB')} bytes</p>{document.description && <p className="text-sm">{document.description}</p>}{document.expiry_date && <p className="text-xs">Expires: {document.expiry_date}</p>}</div>
      <div className="flex gap-3"><button type="button" disabled={!!action} onClick={() => void download(document)} className="text-teal-500 underline">{action === 'download:'+document.id ? 'Downloading…' : 'Download'}</button><button type="button" disabled={!!action} onClick={() => void remove(document.id)} className="text-red-500 underline">{action === 'delete:'+document.id ? 'Deleting…' : 'Delete'}</button></div>
    </li>)}</ul>)}
  </section>;
}
