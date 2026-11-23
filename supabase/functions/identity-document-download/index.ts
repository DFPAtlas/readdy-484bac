import { createClient } from 'npm:@supabase/supabase-js@2.47.0';
import { bucket, MAX_DOCUMENT_SIZE, sha256 } from '../_shared/identity-object.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.match(/^Bearer\s+\S+$/i)) return new Response(null, { status: 401 });
  const headers = { 'Cache-Control': 'no-store' };

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      db: { schema: 'app' },
      global: { headers: { Authorization: authorization } },
    });
    const storage = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!).storage;
    const body = await req.json();
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
    if (current.error || current.data?.sha256 !== ref.sha256 || await sha256(data) !== ref.sha256) {
      return new Response(null, { status: 409, headers });
    }
    return new Response(data, {
      headers: { ...headers, 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
});
