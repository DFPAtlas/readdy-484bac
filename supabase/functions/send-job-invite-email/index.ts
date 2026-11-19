import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const uuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Service worker only; destinations and content are derived from current owned
// records, never from the caller's recipient, subject or HTML.
Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || req.headers.get('authorization') !== `Bearer ${key}`) return json(401, { error: 'Unauthorized worker' });
  try {
    const body = await req.json();
    if (!uuid(body?.invite_id) || !uuid(body?.queue_id)) return json(400, { error: 'Queue and invitation required' });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key, { db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } });
    const read = async (query: any) => { const r = await query; if (r.error) throw r.error; return r.data; };
    const queue = await read(db.from('email_queue').select('id, status, email_type, metadata, dedupe_key').eq('id', body.queue_id).maybeSingle());
    if (!queue || queue.status !== 'processing' || queue.email_type !== 'job_invite' || queue.metadata?.invite_id !== body.invite_id || queue.dedupe_key !== `job-invite:${body.invite_id}`) return json(409, { error: 'Claimed invitation queue required' });
    // A provider acceptance already durably recorded on this claimed queue row
    // must not cause another send when queue completion is retried.
    if (typeof queue.metadata.provider_message_id === 'string' && queue.metadata.provider_message_id) return json(200, { success: true, email_id: queue.metadata.provider_message_id });
    const suppress = (reason: string) => json(200, { success: false, suppressed: true, reason });
    const invite = await read(db.from('job_invites').select('id, job_id, client_id, guard_id, status').eq('id', body.invite_id).maybeSingle());
    if (!invite || invite.status !== 'pending') return suppress('invite_no_longer_pending');
    const job = await read(db.from('jobs').select('id, client_id, job_title, venue_city, status, payment_status, is_deleted, is_draft, start_date, start_time, expires_at').eq('id', invite.job_id).maybeSingle());
    if (!job || job.client_id !== invite.client_id || job.is_deleted || job.is_draft || ['funded','processing','completed','paid_out','refunded'].includes(job.payment_status) || !['open', 'awaiting_guard_selection', 'pending'].includes(job.status) || !job.start_date || (job.expires_at && Date.parse(job.expires_at) <= Date.now())) return suppress('job_unavailable');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(p => [p.type, p.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    if (`${job.start_date}T${job.start_time || '00:00:00'}` <= `${today}T${parts.hour}:${parts.minute}:${parts.second}`) return suppress('job_unavailable');
    const guard = await read(db.from('guards').select('id, user_id, full_name, is_active, verification_status, verified_by, sia_verified, sia_expiry_date, sia_licence_number').eq('id', invite.guard_id).maybeSingle());
    const client = await read(db.from('clients').select('id, user_id, company_name, is_active').eq('id', invite.client_id).maybeSingle());
    if (!guard?.user_id || !client?.user_id || guard.is_active !== true || client.is_active === false || !['approved', 'verified'].includes(guard.verification_status) || !guard.verified_by || guard.sia_verified !== true || !guard.sia_licence_number?.trim() || !guard.sia_expiry_date || guard.sia_expiry_date < today) return suppress('account_unavailable');
    const closed = await read(db.from('account_closures').select('user_id').in('user_id', [guard.user_id, client.user_id]));
    if (!Array.isArray(closed)) throw new Error('Invalid closure response');
    if (closed.length) return suppress('account_closed');
    const prefs = await read(db.from('notification_preferences').select('job_matches, email_frequency').eq('user_id', guard.user_id).maybeSingle());
    if (prefs?.job_matches === false || (prefs?.email_frequency && prefs.email_frequency !== 'instant')) return suppress('preference_disabled');
    const account = await db.auth.admin.getUserById(guard.user_id);
    if (account.error) throw account.error;
    const user = account.data?.user;
    if (!user || user.id !== guard.user_id || !user.email || !user.email_confirmed_at) return suppress('no_verified_email');
    const resend = Deno.env.get('RESEND_API_KEY');
    if (!resend) throw new Error('Email configuration unavailable');
    const html = `<h1>Job invitation</h1><p>Hello ${escape(guard.full_name || 'Guard')},</p><p>${escape(client.company_name || 'A client')} invited you to view ${escape(job.job_title || 'a job')}${job.venue_city ? ` in ${escape(job.venue_city)}` : ''} and apply.</p><p><a href="https://quickguard.uk/guard/job-invites">View your Job Invites</a></p><p>This invitation is not a booking or guarantee of work. Sign in to view the details and decide whether to apply.</p>`;
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json', 'Idempotency-Key': `job-invite:${invite.id}` }, body: JSON.stringify({ from: 'QuickGuard Notifications <notifications@quickguard.uk>', reply_to: 'support@quickguard.uk', to: [user.email], subject: 'QuickGuard — Job invitation', html }) });
    if (!response.ok) throw new Error('Email provider did not accept invitation');
    const sent = await response.json();
    if (typeof sent.id !== 'string' || !sent.id) throw new Error('Email acceptance missing');
    const saved = await db.from('email_queue').update({ metadata: { ...queue.metadata, provider_message_id: sent.id } }).eq('id', queue.id).eq('status', 'processing').select('id').maybeSingle();
    if (saved.error || !saved.data?.id) throw new Error('Email acceptance could not be recorded');
    return json(200, { success: true, email_id: sent.id });
  } catch { return json(503, { error: 'Invitation email could not be processed. Retry required.' }); }
});
