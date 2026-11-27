import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Buffer } from 'node:buffer';
import { PNG } from 'npm:pngjs@7.0.0';

const MAX = 10 * 1024 * 1024;
const corsFor = (req: Request) => {
  const origin = req.headers.get('origin');
  // Local browser UAT is permitted only on this isolated sandbox project.
  const sandbox = Deno.env.get('SUPABASE_URL') === 'https://alfwwggavmyerjyqumuo.supabase.co';
  const allowed = origin === 'https://quickguard.uk' || (sandbox && origin === 'http://localhost:3000');
  return { ...{ 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }, ...(allowed && origin ? {'Access-Control-Allow-Origin':origin} : {}) };
};


Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key || !anon) return reply(503, { error: 'Service unavailable' });
    const jwt = req.headers.get('authorization')?.match(/^Bearer ([^ ]+)$/i)?.[1];
    if (!jwt) return reply(401, { error: 'Authentication required' });
    const db = createClient(url, key, { db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(jwt);
    if (authError || !user) return reply(401, { error: 'Invalid session' });
    const caller = createClient(url, anon, { db: { schema: 'app' }, global: { headers: { Authorization: 'Bearer ' + jwt } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: active, error: activeError } = await caller.rpc('is_active_admin');
    if (activeError || active !== true) return reply(403, { error: 'Active administrator with MFA required' });
    const { data: admin, error: roleError } = await db.schema('app').from('admin_users').select('role,is_active').eq('user_id', user.id).maybeSingle();
    if (roleError || !admin?.is_active || !['admin','super_admin'].includes(admin.role)) return reply(403, { error: 'Content management permission required' });
    const slot = new URL(req.url).searchParams.get('slot') ?? '';
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slot)) return reply(400, { error: 'Invalid image slot' });
    const { data: entry, error: slotError } = await db.from('site_media_slots').select('slot_key,recommended_width,recommended_height').eq('slot_key', slot).maybeSingle();
    if (slotError) return reply(503, { error: 'Registry unavailable' });
    if (!entry) return reply(404, { error: 'Unknown image slot' });
    if (req.headers.get('content-type') !== 'image/png') return reply(415, { error: 'PNG only during initial implementation' });
    if (!req.body) return reply(400, { error: 'Missing image' });
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX) { await reader.cancel(); return reply(413, { error: 'Image exceeds 10 MB' }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const signature = [137,80,78,71,13,10,26,10];
    if (size < 33 || !signature.every((v,i) => bytes[i] === v) || String.fromCharCode(...bytes.slice(12,16)) !== 'IHDR') return reply(422, { error: 'Invalid PNG' });
    const view = new DataView(bytes.buffer);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 8192 || height > 8192 || width * height > 8000000) return reply(422, { error: 'Image dimensions exceed safe decoding limits' });
    if (entry.recommended_width && entry.recommended_height && width * entry.recommended_height !== height * entry.recommended_width) return reply(422, { error: 'Image aspect ratio must match the slot' });
    let clean: Uint8Array;
    try {
      const decoded = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
      if (decoded.width !== width || decoded.height !== height) throw new Error('Dimension mismatch');
      clean = new Uint8Array(PNG.sync.write(decoded));
    } catch { return reply(422, { error: 'Image decoding failed' }); }
    if (clean.byteLength > MAX) return reply(413, { error: 'Re-encoded image exceeds 10 MB' });
    const digest = await crypto.subtle.digest('SHA-256', clean);
    const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    const id = crypto.randomUUID();
    const path = slot + '/' + id + '.png';
    const bucket = db.storage.from('site-media-staging');
    const { error: uploadError } = await bucket.upload(path, clean, { contentType: 'image/png', upsert: false });
    if (uploadError) return reply(503, { error: 'Image storage failed' });
    const { error: insertError } = await db.from('site_media_versions').insert({ id, slot_key: slot, object_path: path, width, height, byte_size: clean.byteLength, mime_type: 'image/png', sha256, created_by: user.id });
    if (insertError) {
      const { error: cleanupError } = await bucket.remove([path]);
      if (cleanupError) console.error('Media staging cleanup failed', id);
      return reply(503, { error: 'Version registration failed' });
    }
    return reply(201, { id, slot, width, height, byte_size: clean.byteLength, mime_type: 'image/png', sha256, status: 'draft' });
  } catch { return reply(500, { error: 'Media upload failed' }); }
});
