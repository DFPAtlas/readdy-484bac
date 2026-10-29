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
  if (action === 'attach') {
    const inboundId = payload.inboundId;
    const ticketId = payload.ticketId;
    if (typeof inboundId !== 'string' || !uuid.test(inboundId) || typeof ticketId !== 'string' || !uuid.test(ticketId))
      return json(400, { error: 'Valid email and ticket IDs required' });
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
