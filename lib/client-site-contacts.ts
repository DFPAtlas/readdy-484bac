export const CLIENT_CONTACT_TYPES = ['primary', 'site_manager', 'emergency', 'finance', 'billing'] as const;
export const CLIENT_CONTACT_FIELDS = 'id, client_id, contact_type, name, role, email, phone, is_default, created_at';
export interface ClientSiteContact {
  id: string; client_id: string; contact_type: string; name: string;
  role: string | null; email: string | null; phone: string | null;
  is_default: boolean | null; created_at: string | null;
}
export interface ClientSiteContactInput { contact_type: string; name: string; role: string; email: string; phone: string; is_default: boolean; }
export class ClientSiteContactError extends Error {}

function contact(row: any, clientId: string): ClientSiteContact {
  if (!row || typeof row.id !== 'string' || row.client_id !== clientId || typeof row.contact_type !== 'string' || typeof row.name !== 'string') throw new ClientSiteContactError('Contact response could not be verified.');
  const text = (v: unknown) => typeof v === 'string' ? v : null;
  return { id: row.id, client_id: clientId, contact_type: row.contact_type, name: row.name, role: text(row.role), email: text(row.email), phone: text(row.phone), is_default: typeof row.is_default === 'boolean' ? row.is_default : null, created_at: text(row.created_at) };
}
function payload(input: ClientSiteContactInput) {
  if (!CLIENT_CONTACT_TYPES.includes(input.contact_type as typeof CLIENT_CONTACT_TYPES[number]) || typeof input.name !== 'string' || !input.name.trim() ||
    !['role', 'email', 'phone'].every(k => typeof input[k as keyof ClientSiteContactInput] === 'string') || typeof input.is_default !== 'boolean') throw new ClientSiteContactError('Choose a contact type and enter a name.');
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) throw new ClientSiteContactError('Enter an email address or leave Email blank.');
  return { contact_type: input.contact_type, name: input.name.trim(), role: input.role.trim(), email, phone: input.phone.trim(), is_default: input.is_default };
}
function live(current: () => boolean) { if (!current()) throw new ClientSiteContactError('Contact request retired.'); }
async function owner(db: any, clientId: string, current: () => boolean): Promise<string> {
  live(current);
  const auth = await db.auth.getUser(); live(current);
  if (auth.error || !auth.data?.user) throw new ClientSiteContactError('Sign in again to manage contacts.');
  const { data, error } = await db.from('clients').select('id, user_id, is_active').eq('id', clientId).eq('user_id', auth.data.user.id).maybeSingle(); live(current);
  if (error || !data || data.id !== clientId || data.user_id !== auth.data.user.id || data.is_active === false) throw new ClientSiteContactError('Your company contacts are unavailable.');
  return auth.data.user.id;
}
async function sameUser(db: any, userId: string, current: () => boolean) {
  live(current); const auth = await db.auth.getUser(); live(current);
  if (auth.error || auth.data?.user?.id !== userId) throw new ClientSiteContactError('Your session changed. Refresh before retrying.');
}
export async function loadClientSiteContacts(db: any, clientId: string, current = () => true, onOwner?: (userId: string) => void): Promise<ClientSiteContact[]> {
  const userId = await owner(db, clientId, current), rows: ClientSiteContact[] = [], seen = new Set<string>();
  onOwner?.(userId);
  for (let offset = 0; ; offset += 200) {
    live(current);
    const { data, error } = await db.from('client_contacts').select(CLIENT_CONTACT_FIELDS).eq('client_id', clientId)
      .order('created_at', { ascending: true, nullsFirst: false }).order('id', { ascending: true }).range(offset, offset + 199); live(current);
    if (error || !Array.isArray(data)) throw new ClientSiteContactError('Contacts could not be loaded. Please retry.');
    const previous = seen.size;
    for (const raw of data) { const row = contact(raw, clientId); if (!seen.has(row.id)) { rows.push(row); seen.add(row.id); } }
    if (data.length < 200) break;
    if (seen.size === previous) throw new ClientSiteContactError('Contacts could not be paged. Refresh and retry.');
  }
  await sameUser(db, userId, current); return rows;
}
export async function saveClientSiteContact(db: any, clientId: string, id: string, input: ClientSiteContactInput, editing: boolean, current = () => true): Promise<ClientSiteContact> {
  const values = payload(input);
  if (!id) throw new ClientSiteContactError('Contact identity is missing. Reopen the form.');
  const userId = await owner(db, clientId, current); live(current);
  const query = editing ? db.from('client_contacts').update(values).eq('id', id).eq('client_id', clientId)
    : db.from('client_contacts').insert({ id, client_id: clientId, ...values });
  let { data, error } = await query.select(CLIENT_CONTACT_FIELDS).maybeSingle(); live(current);
  // A new draft keeps one random ID. Only a unique-key replay with the exact
  // same owned stored values confirms a previously committed lost reply.
  if (!editing && error?.code === '23505') {
    const replay = await db.from('client_contacts').select(CLIENT_CONTACT_FIELDS).eq('id', id).eq('client_id', clientId).maybeSingle(); live(current);
    const row = !replay.error && replay.data ? contact(replay.data, clientId) : null;
    if (!row || row.id !== id || Object.entries(values).some(([key, value]) => (key === 'is_default' ? row.is_default === true : row[key as keyof ClientSiteContact] ?? '') !== value)) throw new ClientSiteContactError('This contact may already exist with different details. Refresh, then edit it.');
    data = row; error = null;
  }
  if (error || !data) throw new ClientSiteContactError('The save could not be confirmed. Your draft is kept; refresh or retry.');
  const row = contact(data, clientId);
  if (row.id !== id) throw new ClientSiteContactError('The saved contact could not be confirmed.');
  await sameUser(db, userId, current); return row;
}
export async function deleteClientSiteContact(db: any, clientId: string, id: string, current = () => true): Promise<void> {
  const userId = await owner(db, clientId, current); live(current);
  const { data, error } = await db.from('client_contacts').delete().eq('id', id).eq('client_id', clientId).select('id, client_id').maybeSingle(); live(current);
  if (error || !data || data.id !== id || data.client_id !== clientId) throw new ClientSiteContactError('Deletion could not be confirmed. Refresh and retry.');
  await sameUser(db, userId, current);
}
