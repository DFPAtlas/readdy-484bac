import { withRequestDeadline } from './request-deadline';
import { verifyMessageOwner } from './job-messages';
export async function createClientSupportTicket(db: any, owner: string, clientId: string, operationId: string, payload: Record<string, unknown>, current = () => true) {
  await verifyMessageOwner(db, owner, current);
  const { data, error } = await withRequestDeadline<any>(db.rpc('create_client_support_ticket', { p_request: { ...payload, operation_id: operationId, expected_user_id: owner, client_id: clientId } }));
  await verifyMessageOwner(db, owner, current);
  if (error || data?.id !== operationId || data.client_id !== clientId || typeof data.replayed !== 'boolean') throw new Error('Ticket save could not be confirmed. Keep these details and retry the same request.');
  return data;
}
export async function closeClientSupportTickets(db: any, owner: string, clientId: string, ids: string[], current = () => true) {
  const closureMessageIds: string[] = [];
  const confirmed = new Set<string>(), requested = [...new Set(ids)];
  for (let offset = 0; offset < requested.length; offset += 200) {
    await verifyMessageOwner(db, owner, current); const batch = requested.slice(offset, offset + 200);
    const { data, error } = await withRequestDeadline<any>(db.rpc('close_client_support_tickets', { p_request: { expected_user_id: owner, client_id: clientId, ids: batch } }));
    await verifyMessageOwner(db, owner, current);
    if (error || !Array.isArray(data?.confirmed_ids) || !Array.isArray(data?.closure_message_ids) || data.closure_message_ids.length !== data.confirmed_ids.length || data.closure_message_ids.some((id: unknown) => typeof id !== 'string') || data.confirmed_ids.some((id: unknown) => typeof id !== 'string' || !batch.includes(id))) {
      if (!confirmed.size) throw new Error('Ticket closure could not be confirmed. Reload before retrying.');
      return { confirmedIds: [...confirmed], closureMessageIds, complete: false };
    }
    closureMessageIds.push(...data.closure_message_ids);
    data.confirmed_ids.forEach((id: string) => confirmed.add(id));
  }
  return { confirmedIds: [...confirmed], closureMessageIds, complete: requested.every(id => confirmed.has(id)) };
}
