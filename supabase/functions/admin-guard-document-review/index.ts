import { createClient } from 'npm:@supabase/supabase-js@2.47.0';
import { bucket, MAX_DOCUMENT_SIZE, type ObjectReference, readBrokerBody, sha256 } from '../_shared/identity-object.ts';

const kinds = ['proof', 'licence', 'back'];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = /^https:\/\/(www\.)?quickguard\.uk$/.test(origin) ||
    /^https:\/\/([\w-]+\.)*readdy\.ai$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers = {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://quickguard.uk',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Document-Type',
    'Cache-Control': 'no-store', Vary: 'Origin',
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return reply({ error: 'Sign in again' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const boundedFetch: typeof fetch = (input, init) => fetch(input, {
      ...init, redirect: 'error', signal: AbortSignal.any([req.signal, AbortSignal.timeout(12_000),
        ...(init?.signal ? [init.signal] : [])]),
    });
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      db: { schema: 'app' }, global: { headers: { Authorization: 'Bearer ' + token }, fetch: boundedFetch },
    });
    const { data: { user }, error } = await userClient.auth.getUser(token);
    if (error || !user || user.is_anonymous) return reply({ error: 'Sign in again' }, 401);

    const body = await readBrokerBody(req);
    if (typeof body?.guardId !== 'string' || !uuid.test(body.guardId)) {
      return reply({ error: 'Guard required' }, 400);
    }
    // The database evaluates the verified JWT's AAL and active role here.
    const { data: state, error: stateError } = await userClient.rpc('guard_document_review_status', { p_guard: body.guardId });
    if (stateError) return reply({ error: 'An active authorised administrator with MFA is required' }, 403);
    if (body.action === 'status') return reply(state);

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'app' }, global: { fetch: boundedFetch },
    });
    const download = async (ref: ObjectReference) => {
      const result = await service.storage.from(bucket).download(ref.path);
      if (result.error || !result.data || result.data.size === 0 || result.data.size > MAX_DOCUMENT_SIZE) {
        throw new Error('Document unavailable');
      }
      const bytes = await result.data.arrayBuffer();
      return { bytes, sha256: await sha256(bytes) };
    };

    if (body.action === 'prepare') {
      const { data: sources, error: sourceError } = await service.rpc('guard_review_sources', {
        p_guard: body.guardId, p_actor: user.id,
      });
      if (sourceError || !sources?.owner || !sources.back) return reply({ error: 'Current licence back unavailable' }, 409);
      const { data: documents, error: documentError } = await service.rpc('identity_document_sources', {
        p_user_id: sources.owner,
      });
      if (documentError || documents?.guard_id !== body.guardId || !documents.proof || !documents.licence) {
        return reply({ error: 'Both current identity documents must be available' }, 409);
      }
      const [proof, licence, back] = await Promise.all([download(documents.proof), download(documents.licence), download(sources.back)]);
      const enqueue = await service.rpc('enqueue_identity_document_check', {
        p_guard_id: body.guardId, p_user_id: sources.owner,
        p_proof: { ...documents.proof, sha256: proof.sha256 },
        p_licence: { ...documents.licence, sha256: licence.sha256 },
      });
      if (enqueue.error) return reply({ error: 'Could not prepare the current submission. Retry after refreshing.' }, 409);
      const review = await service.rpc('begin_guard_document_review', {
        p_guard: body.guardId, p_actor: user.id, p_back: { ...sources.back, sha256: back.sha256 },
      });
      return review.error ? reply({ error: 'Documents changed. Prepare the review again.' }, 409)
        : reply({ success: true });
    }

    if (body.action === 'document' && kinds.includes(body.kind) && state.review?.id === body.reviewId) {
      const args = { p_review: body.reviewId, p_actor: user.id, p_kind: body.kind };
      const { data: ref, error: refError } = await service.rpc('guard_review_document', args);
      if (refError || !ref?.path || !ref.sha256) return reply({ error: 'Document access denied' }, 403);
      const file = await download(ref);
      if (file.sha256 !== ref.sha256) return reply({ error: 'Document changed. Prepare the review again.' }, 409);
      // MIME comes from a fixed validated path suffix; never forward caller headers.
      const suffix = String(ref.path).split('.').pop();
      const mime = suffix === 'pdf' ? 'application/pdf' : suffix === 'png' ? 'image/png'
        : suffix === 'webp' ? 'image/webp' : 'image/jpeg';
      const audit = await service.rpc('guard_review_document', { ...args, p_digest: file.sha256 });
      if (audit.error) return reply({ error: 'Document access could not be confirmed' }, 409);
      return new Response(file.bytes, { headers: {
        ...headers, 'Content-Type': 'application/octet-stream', 'X-Document-Type': mime,
        'X-Content-Type-Options': 'nosniff',
      } });
    }
    return reply({ error: 'Unknown action or stale review' }, 409);
  } catch {
    return reply({ error: 'Document review temporarily unavailable' }, 503);
  }
});
