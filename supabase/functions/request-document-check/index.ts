import { createClient } from 'npm:@supabase/supabase-js@2.47.0';
import { bucket, MAX_DOCUMENT_SIZE, type ObjectReference, sha256 } from '../_shared/identity-object.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = /^https:\/\/(www\.)?quickguard\.uk$/.test(origin) ||
    /^https:\/\/([\w-]+\.)*readdy\.ai$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers = {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://quickguard.uk',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);

  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return reply({ error: 'Please sign in again.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user || user.is_anonymous) return reply({ error: 'Please sign in again.' }, 401);

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'app' },
    });
    const input = await req.json().catch(() => null);
    const { data: guard, error: guardError } = await service.from('guards')
      .select('id,profile_completed').eq('user_id', user.id).maybeSingle();
    if (guardError) return reply({ error: 'Unable to load guard.' }, 500);
    if (!guard || (input?.guard_id && input.guard_id !== guard.id)) {
      return reply({ error: 'Only your own guard record can be queued.' }, 403);
    }
    if (!guard.profile_completed) {
      return reply({ success: true, queued: false, reason: 'not_submitted' });
    }

    if (Deno.env.get('IDENTITY_QUEUE_V2_ENABLED') !== 'true') {
      if (input?.queue_version === 2) return reply({ success: true, queued: false, reason: 'disabled' });
      const { data, error: queueError } = await service.rpc('request_document_check', {
        p_guard_id: guard.id, p_reason: 'reupload',
      });
      return queueError ? reply({ error: 'Could not queue the document check.' }, 503)
        : reply({ success: true, queued: true, check_id: data });
    }

    const { data: sources, error: sourcesError } = await service.rpc('identity_document_sources', {
      p_user_id: user.id,
    });
    if (sourcesError) return reply({ error: 'Could not resolve document references.' }, 503);
    if (!sources?.proof || !sources?.licence || sources.guard_id !== guard.id) {
      return reply({ success: true, queued: false, reason: 'documents_missing' });
    }
    const fingerprint = async (ref: ObjectReference) => {
      const { data: file, error: fetchError } = await service.storage.from(bucket).download(ref.path);
      if (fetchError || !file || file.size > MAX_DOCUMENT_SIZE) throw new Error('Document unavailable');
      return { ...ref, sha256: await sha256(await file.arrayBuffer()) };
    };
    const [proof, licence] = await Promise.all([fingerprint(sources.proof), fingerprint(sources.licence)]);
    // The RPC rechecks the object versions and the guard pointers under the guard lock.
    const { data, error: queueError } = await service.rpc('enqueue_identity_document_check', {
      p_guard_id: guard.id, p_user_id: user.id, p_proof: proof, p_licence: licence,
    });
    if (queueError) {
      const retryable = ['22023', '55000'].includes(queueError.code);
      return reply({ error: 'Could not queue the current documents.' }, retryable ? 409 : 503);
    }
    return reply({ success: true, queued: true, check_id: data });
  } catch {
    return reply({ error: 'The document check is temporarily unavailable.' }, 503);
  }
});
