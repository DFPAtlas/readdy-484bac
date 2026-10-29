/**
 * Untrusted inbound mail can suggest a ticket, but never authorise access to one.
 * Callers MUST confirm sender identity and ticket ownership server-side before linking.
 */
export const SUPPORT_ADDRESS = 'support@quickguard.uk';
export type TicketCandidate = { reference: string | null; reason: 'explicit_reference' | 'none' };
const REF = /\b(?:QG[- ]?T(?:ICKET)?[- #:]*)([A-Z0-9]{5,20})\b/i;
export function normaliseMailbox(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const address = (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase();
  if (address.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(address)) return null;
  return address;
}
export function candidateFromSubject(subject: unknown): TicketCandidate {
  if (typeof subject !== 'string') return { reference: null, reason: 'none' };
  const match = subject.slice(0, 500).match(REF);
  return match ? { reference: match[1].toUpperCase(), reason: 'explicit_reference' }
    : { reference: null, reason: 'none' };
}
export function safePlainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').slice(0, 20000);
}
export function isAllowedSupportRecipient(recipients: unknown): boolean {
  return Array.isArray(recipients) && recipients.some((item) => normaliseMailbox(item) === SUPPORT_ADDRESS);
}
