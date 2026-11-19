import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {status, headers: {...cors, 'Content-Type': 'application/json'}});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  if (req.method !== 'POST') return json(405, {error: 'Method not allowed'});
  const bearer = req.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ') || !bearer.slice(7).trim()) return json(401, {error: 'Authentication required'});
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {db: {schema: 'app'}, auth: {persistSession: false, autoRefreshToken: false}});
    const auth = await db.auth.getUser(bearer.slice(7));
    if (auth.error || !auth.data?.user?.id) return json(401, {error: 'Authentication required'});
    let body;
    try { body = await req.json(); } catch { return json(400, {error: 'Invalid request body'}); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        ![body.requestId, body.clientId, body.jobId, body.assignmentId].every(id => typeof id === 'string' && uuid.test(id)) ||
        !['reason', 'urgency', 'arrival', 'notes', 'phone'].every(key => typeof body[key] === 'string') || typeof body.createTicket !== 'boolean') return json(400, {error: 'Invalid replacement details'});
    const result = await db.rpc('submit_client_replacement_request', {
      p_user_id: auth.data.user.id, p_request_id: body.requestId, p_client_id: body.clientId,
      p_job_id: body.jobId, p_assignment_id: body.assignmentId, p_reason: body.reason,
      p_urgency: body.urgency, p_arrival: body.arrival, p_notes: body.notes, p_phone: body.phone, p_create_ticket: body.createTicket,
    });
    if (result.error) {
      const code = result.error.code;
      return json(code === '42501' ? 403 : ['22023', '22P02'].includes(code) ? 400 : code === '23505' ? 409 : 503,
        {error: 'Request could not be confirmed. Check the job and request details before retrying.',
          outcome: ['42501', '22023', '22P02'].includes(code) ? 'rejected' : 'unconfirmed'});
    }
    const receipt = result.data;
    if (receipt?.requestId !== body.requestId || receipt.clientId !== body.clientId || receipt.jobId !== body.jobId ||
        !(receipt.ticketId === null || typeof receipt.ticketId === 'string' && uuid.test(receipt.ticketId)) ||
        !!receipt.ticketId !== (body.createTicket && ['urgent', 'emergency'].includes(body.urgency))) return json(503, {error: 'Request could not be confirmed'});
    let supportSyncPending = !!receipt.ticketId;
    if (receipt.ticketId) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`${url}/functions/v1/dfp-support-ticket-bridge`, {
          method: 'POST', headers: {Authorization: bearer, apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json'},
          body: JSON.stringify({ticketId: receipt.ticketId}), signal: controller.signal,
        });
        supportSyncPending = !response.ok || (await response.json()).success !== true;
      } catch { supportSyncPending = true; } finally { clearTimeout(timeout); }
    }
    return json(200, {success: true, receipt, supportSyncPending});
  } catch { return json(503, {error: 'Request could not be confirmed'}); }
});
