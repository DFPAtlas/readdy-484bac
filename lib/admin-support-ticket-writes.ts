export interface SavedSupportTicket {
  id: string;
  admin_notes: string | null;
  status: string;
  resolved_at: string | null;
  updated_at: string;
}

export async function updateAdminSupportTicket(
  db: any,
  ticketId: string,
  updates: { admin_notes?: string; status?: string; resolved_at?: string; updated_at: string },
): Promise<SavedSupportTicket> {
  const { data, error } = await db.from('support_tickets')
    .update(updates).eq('id', ticketId).eq('is_deleted', false)
    .select('id, admin_notes, status, resolved_at, updated_at').maybeSingle();
  if (error || !data || data.id !== ticketId) {
    throw new Error('The ticket update could not be confirmed. Reload the inbox before trying again.');
  }
  return data;
}
