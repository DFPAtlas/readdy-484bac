import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Webhook } from 'https://esm.sh/svix@1.41.0';

const respond = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });
const emailAddress = (raw: string) => (raw.match(/<([^<>@\s]+@[^<>@\s]+)>/)?.[1] || raw).trim().toLowerCase();
const MAX_TEXT = 20000;

serve(async (req) => {
  if (req.method !== 'POST') return respond(405, 'Method not allowed');
  const secret = Deno.env.get('QUICKGUARD_RESEND_WEBHOOK_SECRET');
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !apiKey || !url || !serviceKey) return respond(503, 'Not configured');

  let event: any;
  try {
    const raw = await req.text();
    event = new Webhook(secret).verify(raw, {
      'svix-id': req.headers.get('svix-id') || '',
      'svix-timestamp': req.headers.get('svix-timestamp') || '',
      'svix-signature': req.headers.get('svix-signature') || '',
    });
  } catch {
    return respond(401, 'Invalid webhook signature');
  }
  if (event.type !== 'email.received') return respond(200, 'Ignored');
  const emailId = event.data?.email_id;
  const recipients: string[] = event.data?.to || [];
  if (typeof emailId !== 'string' || !/^[a-z0-9-]{16,80}$/i.test(emailId)) return respond(400, 'Invalid email ID');
  if (!recipients.some((to) => to.toLowerCase() === 'support@quickguard.uk')) return respond(200, 'Not support email');

  // The event is metadata only; retrieve text directly from Resend's authenticated receiving API.
  const retrieved = await fetch('https://api.resend.com/emails/receiving/' + encodeURIComponent(emailId), {
    headers: { Authorization: 'Bearer ' + apiKey },
  });
  if (!retrieved.ok) return respond(503, 'Email retrieval unavailable');
  const received = await retrieved.json();
  const sender = emailAddress(String(received.from || ''));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sender)) return respond(200, 'Invalid sender ignored');

  // Stage 1 is deliberately review-only. Email content is untrusted input and must
  // not perform ticket mutations, trigger agent instructions or send automatic replies.
  const text = typeof received.text === 'string' ? received.text.slice(0, MAX_TEXT) : '';
  const supabase = createClient(url, serviceKey, { db: { schema: 'app' },
    auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from('support_inbound_emails').upsert({
    resend_email_id: emailId,
    internet_message_id: String(received.message_id || '').slice(0, 500) || null,
    sender_email: sender,
    recipient_email: 'support@quickguard.uk',
    subject: String(received.subject || '').slice(0, 500),
    body_text: text,
  }, { onConflict: 'resend_email_id', ignoreDuplicates: true });
  if (error) return respond(503, 'Could not store email');
  return respond(200, 'Stored for support review');
});
