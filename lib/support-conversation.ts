interface ReplyInput {
  ticketId: string;
  senderId: string;
  senderType: 'guard' | 'client';
  text: string;
  status: string;
}

// The insert is the save boundary. Later failures must never ask the user to resend.
export async function saveSupportReply(db: any, input: ReplyInput, onSaved: () => void) {
  const { data, error } = await db.from('ticket_messages').insert({
    ticket_id: input.ticketId,
    sender_id: input.senderId,
    sender_type: input.senderType,
    message_text: input.text.trim(),
    is_internal: false,
  }).select('id, created_at').single();
  if (error || !data?.id) throw new Error('Your reply could not be confirmed as saved. Reload the conversation before trying again.');

  onSaved();
  const warnings: string[] = [];
  let statusUpdated = false;
  if (input.status !== 'resolved' && input.status !== 'closed') {
    try {
      const result = await db.from('support_tickets')
        .update({ status: 'under_review', updated_at: new Date().toISOString() })
        .eq('id', input.ticketId).eq('status', input.status).select('id').maybeSingle();
      if (result.error || !result.data?.id) throw new Error('status update not confirmed');
      statusUpdated = true;
    } catch {
      warnings.push('The ticket status could not be updated. You do not need to resend your reply.');
    }
  }

  // Keep the existing client-only delivery path, even if the status update fails.
  if (input.senderType === 'client') {
    try {
      const result = await db.functions.invoke('dfp-support-message-bridge', { body: { messageId: data.id } });
      if (result.error) throw new Error('delivery not confirmed');
    } catch {
      warnings.push('Delivery to support could not be confirmed. You do not need to resend your reply.');
    }
  }
  return { statusUpdated, warnings };
}
