import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dfp-timestamp, x-dfp-nonce, x-dfp-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_LENGTH = 20000;
const MAX_SENDER_NAME_LENGTH = 200;
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

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

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  const secret = Deno.env.get('DFP_REPLY_RECEIVER_SECRET');
  if (!secret) {
    return json(503, { success: false, error: 'Reply connector unavailable' });
  }

  const timestamp = req.headers.get('x-dfp-timestamp') || '';
  const nonce = req.headers.get('x-dfp-nonce') || '';
  const signature = req.headers.get('x-dfp-signature') || '';

  if (!timestamp || !nonce || !signature) {
    return json(401, { success: false, error: 'Missing authentication headers' });
  }

  const timestampMs = Date.parse(timestamp);
  if (Number.isNaN(timestampMs)) {
    return json(401, { success: false, error: 'Invalid timestamp' });
  }
  if (Math.abs(Date.now() - timestampMs) > TIMESTAMP_WINDOW_MS) {
    return json(401, { success: false, error: 'Timestamp outside allowed window' });
  }

  const rawBody = await req.text();

  const bodyHash = await sha256Hex(rawBody);
  const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
  const expectedSignature = await hmacSha256Hex(secret, canonical);

  if (!timingSafeEqualHex(expectedSignature, signature)) {
    return json(401, { success: false, error: 'Invalid signature' });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body' });
  }

  if (body.siteSlug !== 'quickguard') {
    return json(400, { success: false, error: 'Invalid site slug' });
  }

  const quickguardTicketId = typeof body.quickguardTicketId === 'string' ? body.quickguardTicketId : '';
  const dfpMessageId = typeof body.dfpMessageId === 'string' ? body.dfpMessageId : '';
  const dfpTicketNumber = typeof body.dfpTicketNumber === 'string' ? body.dfpTicketNumber.trim() : '';

  if (!UUID_RE.test(quickguardTicketId)) {
    return json(400, { success: false, error: 'quickguardTicketId must be a valid UUID' });
  }
  if (!UUID_RE.test(dfpMessageId)) {
    return json(400, { success: false, error: 'dfpMessageId must be a valid UUID' });
  }
  if (!dfpTicketNumber) {
    return json(400, { success: false, error: 'dfpTicketNumber is required' });
  }

  const message = (body.message && typeof body.message === 'object' ? body.message : {}) as Record<string, unknown>;
  const messageBody = typeof message.body === 'string' ? message.body : '';
  const senderName = typeof message.senderName === 'string' ? message.senderName.trim() : '';
  const createdAt = typeof message.createdAt === 'string' ? message.createdAt : '';

  if (!messageBody.trim()) {
    return json(400, { success: false, error: 'message.body is required' });
  }
  if (messageBody.length > MAX_BODY_LENGTH) {
    return json(400, { success: false, error: 'message.body exceeds maximum length' });
  }
  if (senderName.length > MAX_SENDER_NAME_LENGTH) {
    return json(400, { success: false, error: 'message.senderName exceeds maximum length' });
  }
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    return json(400, { success: false, error: 'message.createdAt must be a valid timestamp' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'app' },
  });

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, status')
    .eq('id', quickguardTicketId)
    .eq('dfp_ticket_number', dfpTicketNumber)
    .eq('dfp_sync_status', 'synced')
    .maybeSingle();

  if (!ticket) {
    return json(404, { success: false, error: 'Ticket not found' });
  }

  const { data: existing } = await supabase
    .from('ticket_messages')
    .select('id')
    .eq('dfp_message_id', dfpMessageId)
    .maybeSingle();

  if (existing) {
    return json(200, { success: true, duplicate: true });
  }

  const normalizedCreatedAt = new Date(createdAt).toISOString();

  const insertData = {
    ticket_id: quickguardTicketId,
    sender_id: null,
    sender_type: 'admin',
    sender_name: senderName || 'QuickGuard Support',
    message_text: messageBody,
    is_internal: false,
    created_at: normalizedCreatedAt,
    dfp_message_id: dfpMessageId,
  };

  const { error: insertError } = await supabase
    .from('ticket_messages')
    .insert(insertData);

  if (insertError) {
    if (insertError.code === '23505') {
      return json(200, { success: true, duplicate: true });
    }
    return json(500, { success: false, error: 'Failed to store reply' });
  }

  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    await supabase
      .from('support_tickets')
      .update({ status: 'awaiting_client', updated_at: new Date().toISOString() })
      .eq('id', quickguardTicketId);
  }

  return json(200, { success: true, duplicate: false });
});
