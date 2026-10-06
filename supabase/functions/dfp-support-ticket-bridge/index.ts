import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DFP_ENDPOINT = 'https://zjqftnkrmqhmbrtkvafy.supabase.co/functions/v1/receive-support-ticket';

const CATEGORY_MAP: Record<string, string> = {
  general_support: 'general',
  payment_issue: 'billing',
  guard_no_show: 'complaint',
  late_arrival: 'complaint',
  poor_performance: 'complaint',
  refund_request: 'billing',
  job_cancellation: 'general',
  technical_issue: 'technical',
  account_billing: 'billing',
};

const PRIORITY_MAP: Record<string, string> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const bridgeSecret = Deno.env.get('DFP_SUPPORT_BRIDGE_SECRET');
  const bridgeKeyPrefix = Deno.env.get('DFP_SUPPORT_BRIDGE_KEY_PREFIX');
  if (!bridgeSecret || !bridgeKeyPrefix) {
    return json(503, { error: 'Support bridge unavailable' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'app' },
  });

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return json(401, { error: 'Authentication required' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  // Service mode (backend retries only): sync one ticket for any client, or sweep
  // unsynced/failed client tickets. Upstream idempotency (x-idempotency-key) and the
  // local 'synced' short-circuit make retries safe: no duplicate Command Centre tickets.
  if (timingSafeEqual(token, supabaseServiceKey)) {
    if (body.retryUnsynced === true) {
      const { data: pending, error: pendingError } = await supabase.from('support_tickets')
        .select('id').not('client_id', 'is', null).eq('is_deleted', false)
        .or('dfp_sync_status.is.null,dfp_sync_status.eq.failed,dfp_sync_status.eq.pending')
        .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
        .order('created_at', { ascending: true }).limit(25);
      if (pendingError) return json(500, { error: 'Unable to load unsynced tickets' });
      const results: Record<string, unknown>[] = [];
      for (const row of pending || []) {
        const r = await syncTicket(supabase, row.id, null, bridgeSecret, bridgeKeyPrefix);
        results.push({ ticketId: row.id, status: r.status, ...r.body });
      }
      return json(200, { success: true, attempted: results.length, synced: results.filter(r => r.success === true).length, results });
    }
    const serviceTicketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
    if (!UUID_RE.test(serviceTicketId)) return json(400, { error: 'ticketId is required' });
    const r = await syncTicket(supabase, serviceTicketId, null, bridgeSecret, bridgeKeyPrefix);
    return json(r.status, r.body);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json(401, { error: 'Authentication required' });
  }

  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
  if (!UUID_RE.test(ticketId)) {
    return json(400, { error: 'ticketId is required' });
  }

  const result = await syncTicket(supabase, ticketId, user.id, bridgeSecret, bridgeKeyPrefix);
  return json(result.status, result.body);
});

async function syncTicket(supabase: any, ticketId: string, ownerUserId: string | null, bridgeSecret: string, bridgeKeyPrefix: string): Promise<{ status: number; body: Record<string, unknown> }> {
  // Owner mode: the ticket must belong to the signed-in client.
  // Service mode (retries): load the ticket first, then its client.
  let client: any = null;
  if (ownerUserId) {
    const { data, error } = await supabase.from('clients').select('id, company_name, contact_name, email, phone').eq('user_id', ownerUserId).maybeSingle();
    if (error) return { status: 500, body: { error: 'Unable to load client account' } };
    if (!data) return { status: 403, body: { error: 'Client account not found' } };
    client = data;
  }

  let ticketQuery = supabase
    .from('support_tickets')
    .select('id, ticket_reference, client_id, related_job_id, category, subject, description, priority, contact_preference, requested_refund_amount, refund_reason, evidence_url, dfp_ticket_number, dfp_sync_status')
    .eq('id', ticketId)
    .eq('is_deleted', false);
  if (client) ticketQuery = ticketQuery.eq('client_id', client.id);
  const { data: ticket, error: ticketError } = await ticketQuery.maybeSingle();
  if (ticketError) return { status: 500, body: { error: 'Unable to load ticket' } };
  if (!ticket) {
    return { status: 404, body: { error: 'Ticket not found' } };
  }
  if (!client) {
    const { data, error } = await supabase.from('clients').select('id, company_name, contact_name, email, phone').eq('id', ticket.client_id).maybeSingle();
    if (error) return { status: 500, body: { error: 'Unable to load client account' } };
    if (!data) return { status: 422, body: { error: 'Ticket has no client account' } };
    client = data;
  }

  if (ticket.dfp_sync_status === 'synced' && ticket.dfp_ticket_number) {
    return { status: 200, body: {
      success: true,
      ticketNumber: ticket.dfp_ticket_number,
      alreadySynced: true,
    } };
  }

  const originalCategory = typeof ticket.category === 'string' ? ticket.category : '';
  const mappedCategory = CATEGORY_MAP[originalCategory] || 'other';

  const originalPriority = typeof ticket.priority === 'string' ? ticket.priority : '';
  const mappedPriority = PRIORITY_MAP[originalPriority] || 'normal';

  const customerName = (typeof client.contact_name === 'string' && client.contact_name.trim())
    ? client.contact_name
    : (typeof client.company_name === 'string' ? client.company_name : '');

  const payload: Record<string, unknown> = {
    siteSlug: 'quickguard',
    externalReference: `quickguard-ticket:${ticketId}`,
    customer: {
      name: customerName,
      email: client.email ?? '',
    },
    ticket: {
      subject: ticket.subject ?? '',
      description: ticket.description ?? '',
      category: mappedCategory,
      priority: mappedPriority,
      sourcePageUrl: 'https://quickguard.uk/client/support',
    },
    consent: {
      privacyAccepted: true,
    },
    context: {
      quickguard_ticket_id: ticketId,
      quickguard_local_category: originalCategory,
      quickguard_client_id: client.id,
      has_evidence: !!ticket.evidence_url,
    },
  };

  if (client.phone) {
    (payload.customer as Record<string, unknown>).phone = client.phone;
  }

  const ctx = payload.context as Record<string, unknown>;
  if (ticket.ticket_reference) {
    ctx.quickguard_ticket_reference = ticket.ticket_reference;
  }
  if (ticket.related_job_id) {
    ctx.related_job_id = ticket.related_job_id;
  }
  if (ticket.contact_preference) {
    ctx.contact_preference = ticket.contact_preference;
  }
  if (ticket.requested_refund_amount !== null && ticket.requested_refund_amount !== undefined) {
    ctx.requested_refund_amount = ticket.requested_refund_amount;
  }
  if (ticket.refund_reason) {
    ctx.refund_reason = ticket.refund_reason;
  }

  const rawBody = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(rawBody);
  const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = await hmacSha256Hex(bridgeSecret, canonical);

  const now = new Date().toISOString();

  await supabase
    .from('support_tickets')
    .update({
      dfp_sync_status: 'pending',
      dfp_sync_last_attempt_at: now,
      dfp_sync_error: null,
    })
    .eq('id', ticketId);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(DFP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dfp-site': 'quickguard',
        'x-dfp-key': bridgeKeyPrefix,
        'x-dfp-timestamp': timestamp,
        'x-dfp-nonce': nonce,
        'x-dfp-signature': signature,
        'x-idempotency-key': `quickguard-ticket:${ticketId}`,
      },
      body: rawBody,
    });
  } catch {
    await supabase
      .from('support_tickets')
      .update({
        dfp_sync_status: 'failed',
        dfp_sync_last_attempt_at: new Date().toISOString(),
        dfp_sync_error: 'DFP Command request failed',
      })
      .eq('id', ticketId);
    return { status: 502, body: { error: 'Support bridge unavailable' } };
  }

  const responseText = await upstreamRes.text();
  let parsed: Record<string, unknown> = {};
  let parseOk = true;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parseOk = false;
  }

  const isOkStatus = upstreamRes.status === 200 || upstreamRes.status === 201;
  const ticketNumber = typeof parsed.ticketNumber === 'string' && parsed.ticketNumber.trim()
    ? parsed.ticketNumber
    : null;

  if (isOkStatus && parsed.success === true && ticketNumber) {
    await supabase
      .from('support_tickets')
      .update({
        dfp_ticket_number: ticketNumber,
        dfp_sync_status: 'synced',
        dfp_synced_at: new Date().toISOString(),
        dfp_sync_last_attempt_at: new Date().toISOString(),
        dfp_sync_error: null,
      })
      .eq('id', ticketId);

    return { status: 200, body: {
      success: true,
      ticketNumber,
      alreadySynced: false,
    } };
  }

  let safeError = 'DFP Command request failed';
  if (isOkStatus && parsed.success === true && !ticketNumber) {
    safeError = 'Invalid DFP Command response';
  } else if (!isOkStatus) {
    safeError = `DFP Command returned ${upstreamRes.status}`;
  } else if (!parseOk) {
    safeError = 'Invalid DFP Command response';
  }

  await supabase
    .from('support_tickets')
    .update({
      dfp_sync_status: 'failed',
      dfp_sync_last_attempt_at: new Date().toISOString(),
      dfp_sync_error: safeError,
    })
    .eq('id', ticketId);

  return { status: 502, body: { error: 'Support bridge unavailable' } };
}
