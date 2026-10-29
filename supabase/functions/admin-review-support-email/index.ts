import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const base = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !serviceKey) return json(503, { error: 'Not configured' });
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return json(401, { error: 'Login required' });
  const token = header.slice(7).trim();
  const db = createClient(base, serviceKey, { db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Login required' });
  const { data: admin, error: adminError } = await db.from('admin_users')
    .select('id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (adminError || !admin || !['super_admin', 'admin'].includes(admin.role)) return json(403, { error: 'Admin access required' });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  if (!payload || typeof payload !== 'object') return json(400, { error: 'Invalid body' });
  const action = payload.action;
  if (action === 'list') {
    const { data, error } = await db.from('support_inbound_emails')
      .select('id, sender_email, recipient_email, subject, body_text, status, created_at, ticket_id')
      .eq('status', 'pending_review').order('created_at', { ascending: false }).limit(50);
    return error ? json(500, { error: 'Inbox unavailable' }) : json(200, { emails: data });
  }
  if (action === 'lookup_ticket') {
    const reference = typeof payload.reference === 'string' ? payload.reference.trim().toUpperCase() : '';
    if (!/^[A-Z0-9-]{4,60}$/.test(reference)) return json(400, { error: 'Valid ticket reference required' });
    const { data, error } = await db.from('support_tickets')
      .select('id, ticket_reference, subject, status, client_id, guard_id')
      .eq('ticket_reference', reference).eq('is_deleted', false).limit(2);
    if (error) return json(500, { error: 'Ticket lookup failed' });
    if (!data || data.length !== 1) return json(404, { error: 'No unique active ticket found' });
    // This is advisory only; a matching reference does not prove email ownership.
    return json(200, { ticket: data[0], warning: 'Review sender ownership before attaching. Email addresses and references can be spoofed.' });
  }
  if (action === 'find_client') {
    const inboundId = payload.inboundId;
    if (typeof inboundId !== 'string' || !uuid.test(inboundId))
      return json(400, { error: 'Valid email ID required' });
    const { data: mail } = await db.from('support_inbound_emails')
      .select('sender_email').eq('id', inboundId).eq('status', 'pending_review').maybeSingle();
    if (!mail) return json(404, { error: 'Pending email not found' });
    const { data: clients, error } = await db.from('clients')
      .select('id, email').ilike('email', mail.sender_email).limit(3);
    if (error) return json(500, { error: 'Client lookup unavailable' });
    return json(200, { clients, warning: 'Email equality is not proof of sender identity. Verify independently.' });
  }
  if (action === 'create_ticket') {
    const inboundId = payload.inboundId;
    const clientId = payload.clientId;
    if (typeof inboundId !== 'string' || !uuid.test(inboundId) ||
        typeof clientId !== 'string' || !uuid.test(clientId))
      return json(400, { error: 'Valid email and client IDs required' });
    if (payload.identityVerified !== true || payload.approvedInternalOnly !== true)
      return json(400, { error: 'Independent identity verification and private-ticket approval required' });
    // The service-only RPC is transaction-safe and revalidates both administrator
    // and sender/client association. The new ticket is NOT published to DFP Command.
    const { data, error } = await db.rpc('create_reviewed_inbound_client_ticket', {
      p_inbound_id: inboundId, p_client_id: clientId, p_admin_user_id: user.id,
    });
    if (error || !Array.isArray(data) || !data[0])
      return json(409, { error: 'Ticket could not be created; review ownership and schema' });
    return json(200, { ticket: data[0] });
  }
  if (action === 'attach') {
    const inboundId = payload.inboundId;
    const ticketId = payload.ticketId;
    if (typeof inboundId !== 'string' || !uuid.test(inboundId) || typeof ticketId !== 'string' || !uuid.test(ticketId))
      return json(400, { error: 'Valid email and ticket IDs required' });
    // Sender equality is a necessary association check, NOT authentication of mail.
    // Fail closed on mismatches and ambiguous owner records; email is kept internal
    // even when it matches because From headers can be spoofed.
    const { data: mail, error: mailError } = await db.from('support_inbound_emails')
      .select('id, sender_email, status').eq('id', inboundId).eq('status', 'pending_review').maybeSingle();
    if (mailError || !mail) return json(404, { error: 'Pending email not found' });
    const { data: ticket, error: ticketError } = await db.from('support_tickets')
      .select('id, client_id, guard_id').eq('id', ticketId).eq('is_deleted', false).maybeSingle();
    if (ticketError || !ticket) return json(404, { error: 'Active ticket not found' });
    if (Number(Boolean(ticket.client_id)) + Number(Boolean(ticket.guard_id)) !== 1)
      return json(409, { error: 'Ticket ownership ambiguous; manual escalation required' });
    const ownerTable = ticket.client_id ? 'clients' : 'guards';
    const ownerId = ticket.client_id || ticket.guard_id;
    const { data: owner, error: ownerError } = await db.from(ownerTable)
      .select('id, email').eq('id', ownerId).maybeSingle();
    if (ownerError || !owner || typeof owner.email !== 'string' ||
        owner.email.trim().toLowerCase() !== mail.sender_email.trim().toLowerCase())
      return json(409, { error: 'Sender does not match ticket owner; manual escalation required' });
    // This performs an INTERNAL note insertion only; staff must inspect mail and select the ticket.
    const { data, error } = await db.rpc('triage_quickguard_support_email',
      { p_inbound_id: inboundId, p_ticket_id: ticketId });
    return error ? json(409, { error: 'Could not attach email; check ticket and review state' }) : json(200, { messageId: data });
  }
  if (action === 'reject') {
    const inboundId = payload.inboundId;
    if (typeof inboundId !== 'string' || !uuid.test(inboundId)) return json(400, { error: 'Valid email ID required' });
    const { data, error } = await db.from('support_inbound_emails').update({ status: 'rejected' })
      .eq('id', inboundId).eq('status', 'pending_review').select('id').maybeSingle();
    return error ? json(500, { error: 'Could not reject email' }) :
      data ? json(200, { rejected: true }) : json(409, { error: 'Email already processed' });
  }
  return json(400, { error: 'Unknown action' });
});
