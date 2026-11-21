'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createClientSupportTicket } from '@/lib/client-support-writes';
import { routeTicketToCommandCentre } from '@/lib/support-routing';
import { useMessageOwner } from '@/hooks/useMessageOwner';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import SupportAvailability from '@/components/SupportAvailability';
interface IntegrationRequest { id: string; ticket_reference: string | null; subject: string; status: string; created_at: string; }
const SUBJECT = 'API integration request';
export default function ClientApiAccessPage() {
  const owner = useMessageOwner();const { loading: authLoading, allowed } = useClientGuard();const { checking, blocked } = useRouteGuard();
  const [clientId, setClientId] = useState<string | null>(null);const [requests, setRequests] = useState<IntegrationRequest[] | null>(null);const [requirements, setRequirements] = useState('');const [error, setError] = useState('');const [message, setMessage] = useState('');const [busy, setBusy] = useState(false);const [reload, setReload] = useState(0);
  const loadedFor = useRef({ userId: '', revision: -1 });const epoch = useRef(0);const lock = useRef(false);const pending = useRef<{ id: string; description: string } | null>(null);
  const ready = owner.ready && !!owner.id && !owner.error && allowed && !checking && !blocked;
  useEffect(() => { const version = ++epoch.current;setClientId(null);setRequests(null);setRequirements('');setError('');setMessage('');setBusy(false);lock.current = false;pending.current = null;
    if (ready && owner.id) void (async () => {
      const profile = await supabase.from('clients').select('id').eq('user_id', owner.id).single();if (profile.error || !profile.data) throw new Error();
      const result = await supabase.from('support_tickets').select('id,ticket_reference,subject,status,created_at').eq('client_id', profile.data.id).eq('is_deleted', false).eq('subject', SUBJECT).order('created_at', { ascending: false });if (result.error) throw new Error();
      if (version === epoch.current) { loadedFor.current = { userId: owner.id || '', revision: owner.revision };setClientId(profile.data.id);setRequests(result.data || []); }
    })().catch(() => { if (version === epoch.current) setError('Integration requests could not be loaded. Retry.'); });
    return () => { epoch.current = version + 1; };
  }, [ready, owner.id, owner.revision, reload]);
  if (authLoading || checking || !owner.ready) return <p>Checking access…</p>;
  if (!ready) return <p>API access requires your signed-in Enterprise client account.</p>;
  const ownedRequests = loadedFor.current.userId === owner.id && loadedFor.current.revision === owner.revision ? requests : null;
  return <main className="min-h-screen bg-[#0B1933] text-slate-300 p-6 sm:p-10"><div className="max-w-3xl mx-auto"><Link href="/client/dashboard" className="text-teal-400 underline">Client dashboard</Link><h1 className="text-2xl font-bold text-white mt-6">API Access</h1>
    <p className="my-4">Integrations are provisioned by QuickGuard support. Tell us the system, required data, expected volume and intended operations. Our team confirms scope and arranges credentials securely before you connect. Never include passwords or API secrets in this form.</p>
    <SupportAvailability />{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button type="button" className="text-teal-400 underline my-3" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload integration requests</button>
    {!ownedRequests && !error && <p>Loading requests…</p>}
    {ownedRequests && <><form onSubmit={async event => { event.preventDefault();if (lock.current || !ownedRequests || !clientId || !owner.id || !requirements.trim()) return;const version = epoch.current;lock.current = true;setBusy(true);setError('');
      const intent = pending.current || { id: crypto.randomUUID(), description: requirements.trim() };pending.current = intent;
      try { const saved = await createClientSupportTicket(supabase, owner.id, clientId, intent.id, { subject: SUBJECT, category: 'technical_issue', description: intent.description, priority: 'normal', contact_preference: 'email' }, () => epoch.current === version);
        if (version !== epoch.current) return;
        setRequests(previous => [...(previous || []).filter(request => request.id !== saved.id), { id: saved.id, ticket_reference: saved.ticket_reference || null, subject: SUBJECT, status: 'open', created_at: new Date().toISOString() }]);
        const routed = await routeTicketToCommandCentre(saved.id);if (version === epoch.current) { setMessage(routed.ok ? 'Integration request saved and sent to central support. Track its progress below.' : 'Integration request saved. Central support synchronisation is pending; the team can see your QuickGuard ticket.');pending.current = null;setRequirements(''); }
      } catch { if (version === epoch.current) setError('The request could not be confirmed. Retry the same request to avoid duplicates.'); }
      finally { if (version === epoch.current) { lock.current = false;setBusy(false); } }
    }}><label className="block">Integration requirements<textarea required maxLength={10000} rows={7} value={requirements} disabled={busy || !!pending.current} onChange={event => setRequirements(event.target.value)} className="block w-full bg-[#111d35] rounded border border-[#1e2d4d] p-3 my-2" /></label><button type="submit" disabled={busy || !clientId || !requirements.trim()} className="bg-teal-500 text-white rounded px-5 py-2">{busy ? 'Sending…' : pending.current ? 'Retry integration request' : 'Request API integration'}</button></form>
      <h2 className="font-bold text-white mt-8 mb-3">Your integration requests</h2>{!ownedRequests.length && <p>No integration requests yet.</p>}<ul>{ownedRequests.map(request => <li className="border border-[#1e2d4d] rounded p-4 my-2" key={request.id}><strong>{request.ticket_reference || request.id}</strong><p>Support status: {request.status.replaceAll('_', ' ')}</p><Link href="/client/support" className="text-teal-400 underline">Read replies in Support Centre</Link></li>)}</ul>
    </>}
  </div></main>;
}
