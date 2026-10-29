'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type InboundEmail = {
  id: string; sender_email: string; subject: string; body_text: string;
  status: string; created_at: string;
};

export default function SupportEmailReviewPage() {
  const [items, setItems] = useState<InboundEmail[]>([]);
  const [ticketIds, setTicketIds] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const invoke = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new Error('Sign in as an administrator first');
    const { data, error: fnError } = await supabase.functions.invoke('admin-review-support-email', {
      body,
    });
    if (fnError) throw new Error('Email review request failed');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const refresh = async () => {
    setError(''); setLoading(true);
    try {
      const data = await invoke({ action: 'list' });
      setItems(data.emails || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load email'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const process = async (email: InboundEmail, action: 'attach' | 'reject') => {
    if (action === 'attach' && !/^[0-9a-f-]{36}$/i.test(ticketIds[email.id] || '')) {
      setError('Enter an existing ticket UUID'); return;
    }
    if (!window.confirm(action === 'attach'
      ? 'Attach this email as an INTERNAL note only? Verify the ticket manually first.'
      : 'Reject this staged email?')) return;
    setBusy(email.id); setError('');
    try {
      await invoke({ action, inboundId: email.id, ...(action === 'attach' ? { ticketId: ticketIds[email.id] } : {}) });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(null); }
  };

  return <main className="p-6 text-slate-100 bg-slate-950 min-h-screen">
    <h1 className="text-2xl font-semibold mb-2">Incoming support email review</h1>
    <p className="text-slate-300 mb-5">Untrusted messages are staged privately. Attaching only creates an internal ticket note; it does not notify customers or DFP Command.</p>
    <button className="border rounded px-3 py-2 mb-4" onClick={() => void refresh()}>Refresh inbox</button>
    {error && <p role="alert" className="text-red-300 mb-4">{error}</p>}
    {loading ? <p>Loading…</p> : items.length === 0 ? <p>No pending emails.</p> :
      <div className="space-y-4">{items.map(email => <article key={email.id} className="border border-slate-700 rounded-lg p-4">
        <div className="font-semibold">{email.subject || '(No subject)'}</div>
        <div className="text-sm text-slate-300">{email.sender_email} · {new Date(email.created_at).toLocaleString()}</div>
        <pre className="whitespace-pre-wrap break-words text-sm bg-slate-900 rounded p-3 my-3 max-h-64 overflow-y-auto">{email.body_text}</pre>
        <label className="text-sm block mb-2" htmlFor={email.id}>Existing ticket UUID (manually verified)</label>
        <input id={email.id} className="bg-slate-800 border border-slate-600 rounded px-2 py-2 w-full mb-2"
          value={ticketIds[email.id] || ''} onChange={e => setTicketIds(old => ({ ...old, [email.id]: e.target.value.trim() }))} />
        <div className="flex gap-3">
          <button disabled={busy !== null} className="bg-teal-700 disabled:opacity-50 px-3 py-2 rounded" onClick={() => void process(email, 'attach')}>Attach internally</button>
          <button disabled={busy !== null} className="border border-slate-600 disabled:opacity-50 px-3 py-2 rounded" onClick={() => void process(email, 'reject')}>Reject</button>
        </div>
      </article>)}</div>}
  </main>;
}
