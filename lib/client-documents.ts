import { CLIENT_DOCUMENT_FIELDS, CLIENT_DOCUMENT_MAX_BYTES, CLIENT_DOCUMENT_TYPES, documentDetails, documentFileType } from '@/supabase/functions/_shared/client-document-rules';
export { CLIENT_DOCUMENT_MAX_BYTES, CLIENT_DOCUMENT_TYPES };
export interface ClientDocument {
  id: string; client_id: string; document_type: string; file_name: string; file_size: number;
  mime_type: string; description: string | null; expiry_date: string | null; created_at: string | null;
}
export interface ClientDocumentDraft { id: string; file: File; document_type: string; description: string; expiry_date: string; }
export class ClientDocumentError extends Error {}
const failure = 'The document request could not be confirmed. Keep your file and retry, or reload the list.';
function live(current: () => boolean) { if (!current()) throw new ClientDocumentError('Document request retired.'); }
function row(raw: any, clientId: string): ClientDocument {
  if (!raw || typeof raw.id !== 'string' || raw.client_id !== clientId || !CLIENT_DOCUMENT_TYPES.includes(raw.document_type) || typeof raw.file_name !== 'string' || !Number.isInteger(raw.file_size) || raw.file_size < 1 || raw.file_size > CLIENT_DOCUMENT_MAX_BYTES || typeof raw.mime_type !== 'string') throw new ClientDocumentError(failure);
  return { id: raw.id, client_id: clientId, document_type: raw.document_type, file_name: raw.file_name, file_size: raw.file_size, mime_type: raw.mime_type, description: typeof raw.description === 'string' ? raw.description : null, expiry_date: typeof raw.expiry_date === 'string' ? raw.expiry_date : null, created_at: typeof raw.created_at === 'string' ? raw.created_at : null };
}
async function owner(db: any, clientId: string, current: () => boolean) {
  live(current); const auth = await db.auth.getUser(); live(current);
  if (auth.error || !auth.data?.user) throw new ClientDocumentError('Sign in again to manage documents.');
  const userId = auth.data.user.id;
  const result = await db.from('clients').select('id, user_id, is_active').eq('id',clientId).eq('user_id',userId).maybeSingle(); live(current);
  if (result.error || !result.data || result.data.id !== clientId || result.data.user_id !== userId || result.data.is_active === false) throw new ClientDocumentError('Your company documents are unavailable.');
  return userId;
}
async function sameUser(db: any, userId: string, current: () => boolean) {
  live(current); const auth = await db.auth.getUser(); live(current);
  if (auth.error || auth.data?.user?.id !== userId) throw new ClientDocumentError('Your account changed. Reload your profile.');
}
export async function loadClientDocuments(db: any, clientId: string, current = () => true, onOwner?: (userId: string) => void) {
  const userId = await owner(db,clientId,current), rows: ClientDocument[] = [], seen = new Set<string>();
  onOwner?.(userId);
  for (let offset = 0; ; offset += 200) {
    const result = await db.from('client_documents').select(CLIENT_DOCUMENT_FIELDS).eq('client_id',clientId).order('created_at',{ ascending: false, nullsFirst: false }).order('id',{ ascending: true }).range(offset,offset+199); live(current);
    if (result.error || !Array.isArray(result.data)) throw new ClientDocumentError('Documents could not be loaded. Please retry.');
    const before = seen.size;
    for (const raw of result.data) { const document = row(raw,clientId); if (!seen.has(document.id)) { rows.push(document); seen.add(document.id); } }
    if (result.data.length < 200) break;
    if (seen.size === before) throw new ClientDocumentError('Documents could not be paged. Reload and retry.');
  }
  await sameUser(db,userId,current); return rows;
}
export async function saveClientDocument(db: any, clientId: string, draft: ClientDocumentDraft, current = () => true) {
  const details = documentDetails(draft.document_type,draft.description,draft.expiry_date);
  const fileType = documentFileType(draft.file.name,draft.file.type);
  if (!draft.file.size || draft.file.size > CLIENT_DOCUMENT_MAX_BYTES) throw new ClientDocumentError('Choose a file up to 10MB.');
  const userId = await owner(db,clientId,current);
  const body = new FormData();
  for (const [key,value] of Object.entries({ action: 'upload', id: draft.id, expected_client_id: clientId, document_type: details.document_type, description: details.description, expiry_date: details.expiry_date || '' })) body.set(key,value);
  // Some platforms supply an empty File.type. Preserve the bytes/name while
  // explicitly sending the validated extension's MIME in the multipart part.
  body.set('file',new Blob([draft.file],{ type: fileType.mime }),draft.file.name); live(current);
  const result = await db.functions.invoke('manage-client-documents',{ body }); live(current);
  if (result.error || !result.data?.document) throw new ClientDocumentError(failure);
  const saved = row(result.data.document,clientId);
  if (saved.id !== draft.id || saved.file_name !== draft.file.name.trim() || saved.file_size !== draft.file.size || saved.mime_type !== fileType.mime || saved.document_type !== details.document_type || (saved.description || '') !== details.description || saved.expiry_date !== details.expiry_date) throw new ClientDocumentError(failure);
  await sameUser(db,userId,current); return saved;
}
export async function deleteClientDocument(db: any, clientId: string, id: string, current = () => true) {
  const userId = await owner(db,clientId,current); live(current);
  const result = await db.functions.invoke('manage-client-documents',{ body: { action: 'delete', id, expected_client_id: clientId } }); live(current);
  if (result.error || result.data?.deleted_id !== id) throw new ClientDocumentError('Deletion could not be confirmed. Reload or retry.');
  await sameUser(db,userId,current);
}
export async function downloadClientDocument(db: any, clientId: string, id: string, current = () => true): Promise<Blob> {
  const userId = await owner(db,clientId,current); live(current);
  const result = await db.functions.invoke('manage-client-documents',{ body: { action: 'download', id, expected_client_id: clientId } }); live(current);
  if (result.error || !(result.data instanceof Blob) || !result.data.size || result.data.size > CLIENT_DOCUMENT_MAX_BYTES) throw new ClientDocumentError('Download could not be confirmed. Please retry.');
  await sameUser(db,userId,current); return result.data;
}
