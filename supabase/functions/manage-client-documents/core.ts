import { CLIENT_DOCUMENT_FIELDS, CLIENT_DOCUMENT_MAX_BYTES, documentDetails, documentFileType, documentSignature } from '../_shared/client-document-rules.ts';
const BUCKET = 'client-files';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
class RequestError extends Error { constructor(public status: number, message: string) { super(message); } }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const digest = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2,'0')).join('');
async function boundedBody(req: Request) {
  const limit = req.headers.get('content-type')?.startsWith('multipart/form-data') ? CLIENT_DOCUMENT_MAX_BYTES + 65536 : 8192;
  if (Number(req.headers.get('content-length')) > limit) throw new RequestError(413,'The request is too large.');
  const reader = req.body?.getReader(); if (!reader) throw new RequestError(400,'Missing request body.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new RequestError(413,'The request is too large.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part,offset); offset += part.length; }
  return new Request(req.url, { method: 'POST', headers: { 'Content-Type': req.headers.get('content-type') || 'application/json' }, body: bytes });
}
export async function handleClientDocuments(req: Request, db: any): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok',{ headers: cors });
  if (req.method !== 'POST') return json(405,{ error: 'Method not allowed.' });
  try {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json(401,{ error: 'Sign in to manage documents.' });
    const auth = await db.auth.getUser(token);
    if (auth.error || !auth.data?.user) return json(401,{ error: 'Sign in to manage documents.' });
    const userId = auth.data.user.id;
    const profile = await db.from('clients').select('id, user_id, is_active').eq('user_id',userId).maybeSingle();
    if (profile.error) throw new Error('Profile read failed');
    if (!profile.data || profile.data.user_id !== userId || profile.data.is_active === false) return json(403,{ error: 'An active client account is required.' });
    const clientId = profile.data.id;
    const allowed = async () => {
      const closed = await db.from('account_closures').select('id').eq('user_id',userId).maybeSingle();
      const current = await db.from('clients').select('id, user_id, is_active').eq('id',clientId).eq('user_id',userId).maybeSingle();
      if (closed.error || current.error) throw new Error('Account check failed');
      if (closed.data || !current.data || current.data.id !== clientId || current.data.user_id !== userId || current.data.is_active === false) throw new RequestError(403,'Your account cannot manage documents.');
    };
    await allowed();
    const body = await boundedBody(req);
    const multipart = body.headers.get('content-type')?.startsWith('multipart/form-data');
    let input: any;
    try { input = multipart ? await body.formData() : await body.json(); } catch { throw new RequestError(400,'Invalid document request.'); }
    const action = multipart ? input.get('action') : input?.action;
    const expectedClient = multipart ? input.get('expected_client_id') : input?.expected_client_id;
    if (expectedClient !== clientId) throw new RequestError(403,'Your account changed. Reload your profile.');
    const rawId = multipart ? input.get('id') : input?.id;
    if (typeof rawId !== 'string' || !UUID.test(rawId) || !['upload','download','delete'].includes(action)) throw new RequestError(400,'Invalid document request.');
    const id = rawId.toLowerCase();
    const folder = `${userId}/${clientId}/${id}`;
    const storage = db.storage.from(BUCKET);
    const read = async () => {
      const result = await db.from('client_documents').select(`${CLIENT_DOCUMENT_FIELDS}, file_url, content_sha256`).eq('id',id).eq('client_id',clientId).maybeSingle();
      if (result.error || result.data === undefined) throw new Error('Document read failed');
      if (result.data && (result.data.id !== id || result.data.client_id !== clientId)) throw new Error('Document identity mismatch');
      return result.data;
    };
    const safe = (row: any) => Object.fromEntries(CLIENT_DOCUMENT_FIELDS.split(',').map(k => k.trim()).map(k => [k,row[k]]));
    const pathFor = (row: any) => {
      const type = documentFileType(row.file_name,row.mime_type);
      const expected = `${folder}/file.${type.extension}`;
      if (row.file_url !== expected) throw new RequestError(409,'This document needs a storage ownership review.');
      return expected;
    };
    const removeFolder = async () => {
      const list = async () => {
        const result = await storage.list(folder,{ limit: 10, offset: 0, sortBy: { column: 'name', order: 'asc' } });
        if (result.error || !Array.isArray(result.data) || result.data.length >= 10 || result.data.some((v: any) => !v.id || typeof v.name !== 'string' || !/^file\.(pdf|png|jpg|jpeg|doc|docx)$/.test(v.name))) throw new Error('File inventory could not be confirmed');
        return result.data.map((v: any) => `${folder}/${v.name}`);
      };
      const paths = await list();
      if (paths.length) { await allowed(); const removed = await storage.remove(paths); if (removed.error) throw new Error('File removal failed'); }
      if ((await list()).length) throw new Error('File removal could not be confirmed');
    };
    const existing = await read();
    if (action === 'download') {
      if (!existing) return json(404,{ error: 'Document unavailable. Reload and retry.' });
      const result = await storage.download(pathFor(existing));
      if (result.error || !(result.data instanceof Blob)) throw new Error('Download failed');
      const bytes = await result.data.arrayBuffer();
      if (bytes.byteLength !== existing.file_size || !existing.content_sha256 || await digest(bytes) !== existing.content_sha256) throw new Error('File integrity check failed');
      await allowed();
      return new Response(bytes,{ headers: { ...cors, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(existing.file_name)}`, 'X-Content-Type-Options': 'nosniff' } });
    }
    if (action === 'delete') {
      if (existing) pathFor(existing);
      await removeFolder(); await allowed();
      const removed = await db.from('client_documents').delete().eq('id',id).eq('client_id',clientId).select('id, client_id').maybeSingle();
      if (removed.error) throw new Error('Record removal failed');
      if (removed.data && (removed.data.id !== id || removed.data.client_id !== clientId)) throw new Error('Record removal mismatch');
      if (await read()) throw new Error('Record removal could not be confirmed');
      return json(200,{ deleted_id: id });
    }
    if (!multipart) throw new RequestError(400,'Choose a file to upload.');
    const file = input.get('file');
    if (!(file instanceof File) || file.size < 1 || file.size > CLIENT_DOCUMENT_MAX_BYTES) throw new RequestError(400,'Choose a file up to 10MB.');
    let type: { extension: string; mime: string }, details: ReturnType<typeof documentDetails>;
    try { type = documentFileType(file.name,file.type); details = documentDetails(input.get('document_type'),input.get('description'),input.get('expiry_date')); } catch { throw new RequestError(400,'Review the file type, name, description and expiry date.'); }
    const bytes = await file.arrayBuffer();
    if (!documentSignature(type.extension,new Uint8Array(bytes))) throw new RequestError(400,'The file content does not match its type.');
    const hash = await digest(bytes), path = `${folder}/file.${type.extension}`;
    const values = { id, client_id: clientId, ...details, file_name: file.name.trim(), file_url: path, file_size: file.size, mime_type: type.mime, content_sha256: hash };
    const matches = (row: any) => row && Object.entries(values).every(([key,value]) => (row[key] ?? null) === value);
    if (existing) {
      if (!matches(existing)) throw new RequestError(409,'This document was already saved with different details. Reload the list before retrying.');
      const stored = await storage.download(pathFor(existing));
      if (stored.error || !(stored.data instanceof Blob) || await digest(await stored.data.arrayBuffer()) !== hash) throw new Error('Stored file could not be confirmed');
      await allowed(); return json(200,{ document: safe(existing) });
    }
    await allowed();
    // Never overwrite a previous attempt. A lost upload reply can be recovered
    // only by reading and hashing the same private object under this owner/id.
    let uploaded: any;
    try { uploaded = await storage.upload(path,bytes,{ contentType: type.mime, upsert: false }); } catch { uploaded = { error: true }; }
    if (uploaded.error || uploaded.data?.path !== path) {
      const prior = await storage.download(path);
      if (prior.error || !(prior.data instanceof Blob) || await digest(await prior.data.arrayBuffer()) !== hash) throw new Error('Upload could not be confirmed');
    }
    await allowed();
    let saved: any;
    try { saved = await db.from('client_documents').insert(values).select(`${CLIENT_DOCUMENT_FIELDS}, file_url, content_sha256`).maybeSingle(); } catch { saved = { error: true }; }
    const row = !saved.error && saved.data ? saved.data : await read();
    if (!matches(row)) {
      // Keep the object on uncertain database outcomes so a later retry can
      // recover. Do not erase a file that may already have a committed record.
      throw new Error('Document save could not be confirmed');
    }
    await allowed(); return json(200,{ document: safe(row) });
  } catch (error) {
    return error instanceof RequestError ? json(error.status,{ error: error.message }) : json(503,{ error: 'The document request could not be confirmed. Keep your file and retry, or reload the list.' });
  }
}
