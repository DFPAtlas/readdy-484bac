export const GUARD_MEMBERSHIPS_RETIRED = {
  code: 'guard_memberships_retired',
  error: 'Guard job access is free. New paid guard memberships and paid plan renewals are no longer offered. Manage existing billing records on your dashboard or contact support.',
};

export function isGuardMembership(accountType: unknown, planSlug: unknown): boolean {
  return accountType === 'guard' || (typeof planSlug === 'string' && /^guard(?:-|_)/.test(planSlug));
}
