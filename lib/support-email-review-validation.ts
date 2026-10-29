/**
 * Email headers and ticket references are untrusted matching hints, never proof of identity.
 * Only the backend may approve customer-visible ticket messages after ownership checks.
 */
export function validTicketReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reference = value.trim().toUpperCase();
  return /^[A-Z0-9-]{4,60}$/.test(reference) ? reference : null;
}
export function validUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function isSupportAdmin(role: unknown, active: unknown): boolean {
  return active === true && (role === 'admin' || role === 'super_admin');
}
export function isReviewOnlyAction(action: unknown): boolean {
  return action === 'list' || action === 'lookup_ticket' || action === 'attach' || action === 'reject';
}
