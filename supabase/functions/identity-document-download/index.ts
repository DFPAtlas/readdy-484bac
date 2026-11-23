import { createClient } from 'npm:@supabase/supabase-js@2.47.0';
import { bucket, MAX_DOCUMENT_SIZE, matchesCapturedDocument, readBrokerBody } from '../_shared/identity-object.ts';

Deno.serve(async (req) => {
  const headers = { 'Cache-Control': 'no-store' };
  if (req.method !== 'POST') return new Response(null, { status: 405, headers });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.match(/^Bearer\s+\S+$/i)) return new Response(null, { status: 401, headers });

  try {
    const body = await readBrokerBody(req);
    if (!body) return new Response(null, { status: 400, headers });
    const boundedFetch: typeof fetch = (input, init) => fetch(input, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(12_000), ...(init?.signal ? [init.signal] : [])]),
    });
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      db: { schema: 'app' },
      global: { headers: { Authorization: authorization }, fetch: boundedFetch },
    });
    const storage = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      global: { fetch: boundedFetch },
    }).storage;
    if (body?.ready === true) {
      const ready = await client.rpc('identity_document_queue_ready');
      if (ready.error || ready.data !== true) return new Response(null, { status: 403, headers });
      const info = await storage.getBucket(bucket);
      return new Response(null, { status: info.error || info.data?.public !== false ? 503 : 204, headers });
    }
    if (!['proof', 'licence'].includes(body?.kind) || typeof body?.job !== 'string' ||
        typeof body?.token !== 'string') return new Response(null, { status: 400, headers });
    const args = { p_job: body.job, p_token: body.token, p_kind: body.kind };
    const { data: ref, error } = await client.rpc('identity_document_access', args);
    if (error || !ref?.sha256 || !ref.path) return new Response(null, { status: 403, headers });
    const { data: file, error: fetchError } = await storage.from(bucket).download(ref.path);
    if (fetchError || !file || file.size > MAX_DOCUMENT_SIZE) {
      return new Response(null, { status: 409, headers });
    }
    const data = await file.arrayBuffer();
    const current = await client.rpc('identity_document_access', args);
    if (!await matchesCapturedDocument(data, ref.sha256, current.error ? null : current.data?.sha256)) {
      return new Response(null, { status: 409, headers });
    }
    return new Response(data, {
      headers: { ...headers, 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
});
