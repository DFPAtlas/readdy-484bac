import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DFP_ENDPOINT = 'https://zjqftnkrmqhmbrtkvafy.supabase.co/functions/v1/receive-support-message';

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
    return json(503, { error: 'Support message bridge unavailable' });
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

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json(401, { error: 'Authentication required' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  if (!UUID_RE.test(messageId)) {
    return json(400, { error: 'messageId is required' });
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!client) {
    return json(403, { error: 'Client account not found' });
  }

  const { data: message } = await supabase
    .from('ticket_messages')
    .select('id, ticket_id, sender_id, sender_type, message_text, is_internal, created_at, dfp_sync_status')
    .eq('id', messageId)
    .maybeSingle();

  if (!message) {
    return json(404, { error: 'Message not found' });
  }

  if (message.sender_type !== 'client') {
    return json(400, { error: 'Only client messages can be forwarded' });
  }

  if (message.is_internal === true) {
    return json(400, { error: 'Internal messages cannot be forwarded' });
  }

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, client_id, dfp_sync_status, dfp_ticket_number')
    .eq('id', message.ticket_id)
    .eq('client_id', client.id)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!ticket) {
    return json(404, { error: 'Ticket not found' });
  }

  if (ticket.dfp_sync_status !== 'synced' || !ticket.dfp_ticket_number) {
    return json(409, { error: 'Ticket is not synchronised with DFP Command' });
  }

  if (message.dfp_sync_status === 'synced') {
    return json(200, { success: true, alreadySynced: true });
  }

  const payload: Record<string, unknown> = {
    siteSlug: 'quickguard',
    dfpTicketNumber: ticket.dfp_ticket_number,
    quickguardTicketId: ticket.id,
    quickguardMessageId: message.id,
    message: {
      body: message.message_text,
      createdAt: message.created_at,
    },
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(rawBody);
  const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = await hmacSha256Hex(bridgeSecret, canonical);

  const now = new Date().toISOString();

  await supabase
    .from('ticket_messages')
    .update({
      dfp_sync_status: 'pending',
      dfp_sync_last_attempt_at: now,
      dfp_sync_error: null,
    })
    .eq('id', message.id);

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
      },
      body: rawBody,
    });
  } catch {
    await supabase
      .from('ticket_messages')
      .update({
        dfp_sync_status: 'failed',
        dfp_sync_last_attempt_at: new Date().toISOString(),
        dfp_sync_error: 'DFP Command request failed',
      })
      .eq('id', message.id);
    return json(502, { error: 'Support message bridge unavailable' });
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
  const isDuplicate = parsed.duplicate === true;

  if (isOkStatus && parsed.success === true) {
    await supabase
      .from('ticket_messages')
      .update({
        dfp_sync_status: 'synced',
        dfp_synced_at: new Date().toISOString(),
        dfp_sync_last_attempt_at: new Date().toISOString(),
        dfp_sync_error: null,
      })
      .eq('id', message.id);

    return json(200, {
      success: true,
      alreadySynced: false,
      duplicate: isDuplicate,
    });
  }

  let safeError = 'DFP Command request failed';
  if (!isOkStatus) {
    safeError = `DFP Command returned ${upstreamRes.status}`;
  } else if (!parseOk) {
    safeError = 'Invalid DFP Command response';
  }

  await supabase
    .from('ticket_messages')
    .update({
      dfp_sync_status: 'failed',
      dfp_sync_last_attempt_at: new Date().toISOString(),
      dfp_sync_error: safeError,
    })
    .eq('id', message.id);

  return json(502, { error: 'Support message bridge unavailable' });
});
