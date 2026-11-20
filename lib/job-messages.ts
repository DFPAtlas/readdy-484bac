import { withRequestDeadline } from './request-deadline';
export interface JobMessage { id: string; job_id: string | null; sender_id: string; receiver_id: string; sender_type: string; receiver_type: string; message_text: string; read: boolean; created_at: string; }
export async function verifyMessageOwner(db: any, owner: string, current = () => true) {
  if (!current()) throw new Error('Message request retired.');
  const auth = await withRequestDeadline<any>(db.auth.getUser());
  if (!current() || auth.error || !owner || auth.data?.user?.id !== owner) throw new Error('Your message account changed. Reload before retrying.');
}
/** Complete owned history. Partner filtering is applied BEFORE each range. */
export async function readMessageRows(db: any, owner: string, context?: { other: string; job: string | null }, current = () => true): Promise<JobMessage[]> {
  await verifyMessageOwner(db, owner, current);
  const rows: JobMessage[] = [], seen = new Set<string>(); let expected: number | undefined;
  while (true) {
    if (!current()) throw new Error('Message request retired.');
    let query = db.from('messages').select('*', { count: 'exact' });
    if (context) {
      const me = JSON.stringify(owner), other = JSON.stringify(context.other);
      query = query.or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`);
      query = context.job ? query.eq('job_id', context.job) : query.is('job_id', null);
    } else query = query.or(`sender_id.eq.${JSON.stringify(owner)},receiver_id.eq.${JSON.stringify(owner)}`);
    const result = await withRequestDeadline<any>(query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(rows.length, rows.length + 199));
    if (!current()) throw new Error('Message request retired.');
    await verifyMessageOwner(db, owner, current);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count < 0 || result.data.length > 200 || (expected !== undefined && result.count !== expected)) throw new Error('Complete message history could not be loaded. Please retry.');
    expected = result.count as number;
    for (const row of result.data) {
      if (!row || typeof row.id !== 'string' || seen.has(row.id) || (row.sender_id !== owner && row.receiver_id !== owner) || (context && (row.job_id !== context.job || (row.sender_id === owner ? row.receiver_id : row.sender_id) !== context.other))) throw new Error('Message history could not be verified.');
      seen.add(row.id); rows.push(row);
    }
    if (rows.length === expected) break;
    if (!result.data.length || rows.length > expected) throw new Error('Complete message history could not be loaded.');
  }
  await verifyMessageOwner(db, owner, current); return rows;
}
export function messageHistoryPage(rows: JobMessage[], before?: string, size = 40) {
  let start = 0;
  if (before) { const index = rows.findIndex(row => JSON.stringify([row.created_at, row.id]) === before); if (index < 0) throw new Error('Message history changed. Reload the conversation.'); start = index + 1; }
  const page = rows.slice(start, start + size), oldest = page.at(-1);
  return { messages: [...page].reverse(), hasMore: start + size < rows.length, cursor: oldest ? JSON.stringify([oldest.created_at, oldest.id]) : null };
}
export async function readMessagePartners(db: any, owner: string, ids: string[], current = () => true): Promise<any[]> {
  const rows: any[] = [];
  for (let n = 0; n < ids.length; n += 200) {
    const batch = ids.slice(n, n + 200); await verifyMessageOwner(db, owner, current);
    const { data, error } = await withRequestDeadline<any>(db.rpc('get_my_message_partners', { p_user_ids: batch }));
    if (!current() || error || !Array.isArray(data) || data.some(row => !row || !batch.includes(row.user_id))) throw new Error('Conversation contacts could not be loaded.');
    rows.push(...data);
  }
  return rows;
}
export async function sendJobMessage(db: any, request: { id: string; owner: string; other: string; job: string | null; text: string }, current = () => true) {
  await verifyMessageOwner(db, request.owner, current);
  const { data, error } = await withRequestDeadline<any>(db.rpc('send_owned_job_message', { p_request: { operation_id: request.id, expected_user_id: request.owner, receiver_id: request.other, job_id: request.job, text: request.text.trim() } }));
  await verifyMessageOwner(db, request.owner, current);
  if (error || data?.id !== request.id || data.sender_id !== request.owner || data.receiver_id !== request.other || data.job_id !== request.job || data.message_text !== request.text.trim() || typeof data.replayed !== 'boolean') throw new Error('Message save could not be confirmed. Retry the same message.');
  return data;
}
export async function changeJobMessages(db: any, owner: string, ids: string[], action: 'read' | 'unread' | 'delete', current = () => true) {
  const requested = [...new Set(ids)], confirmed = new Set<string>();
  for (let n = 0; n < requested.length; n += 200) {
    await verifyMessageOwner(db, owner, current); const batch = requested.slice(n, n + 200);
    const { data, error } = await withRequestDeadline<any>(db.rpc('change_owned_job_messages', { p_request: { expected_user_id: owner, ids: batch, action } }));
    await verifyMessageOwner(db, owner, current);
    if (error || !Array.isArray(data?.confirmed_ids) || data.confirmed_ids.some((id: unknown) => typeof id !== 'string' || !batch.includes(id))) {
      if (!confirmed.size) throw new Error('Message changes could not be confirmed. Reload before retrying.');
      return { confirmedIds: [...confirmed], complete: false };
    }
    data.confirmed_ids.forEach((id: string) => confirmed.add(id));
  }
  return { confirmedIds: [...confirmed], complete: requested.every(id => confirmed.has(id)) };
}
