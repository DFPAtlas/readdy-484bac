/** Pure rules for preparing an outbound support email. No network or database access. */
export type PreparedReply = {
  idempotencyKey: string; recipient: string; subject: string; body: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function prepareSupportReply(input: {
  ticketId: unknown; messageId: unknown; recipient: unknown; subject: unknown; body: unknown;
}): PreparedReply | null {
  if (typeof input.ticketId !== 'string' || !UUID.test(input.ticketId) ||
      typeof input.messageId !== 'string' || !UUID.test(input.messageId) ||
      typeof input.recipient !== 'string' || input.recipient.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient) ||
      typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 500 ||
      typeof input.body !== 'string' || !input.body.trim() || input.body.length > 20000) return null;
  return {
    idempotencyKey: `ticket:${input.ticketId.toLowerCase()}:message:${input.messageId.toLowerCase()}`,
    recipient: input.recipient.toLowerCase(), subject: input.subject.trim(), body: input.body,
  };
}
