export interface GuardPayoutProfile { id: string; userId: string; fullName: string; }
export interface GuardStripeStatus {
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  status: 'not_started' | 'pending' | 'restricted' | 'ready';
  requirementsDue: string[];
  restrictedReason: string | null;
  lastCheckedAt: string | null;
}
export type GuardStripeAction = 'create-guard-connect-account' | 'create-guard-onboarding-link' | 'create-guard-dashboard-link';

export async function loadGuardPayoutProfile(client: any): Promise<GuardPayoutProfile | null> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw new Error('Your account could not be confirmed. Please sign in again.');
  if (!user) return null;
  const result = await client.from('guards').select('id,full_name').eq('user_id', user.id).maybeSingle();
  if (result.error) throw new Error('Your payout profile could not be loaded. Please retry.');
  if (!result.data?.id) throw new Error('No guard profile was found for this account. Contact support.');
  return { id: result.data.id, userId: user.id, fullName: result.data.full_name || 'Guard' };
}

export function parseGuardStripeStatus(value: any): GuardStripeStatus {
  const valid = value && ['connected', 'detailsSubmitted', 'payoutsEnabled', 'transfersEnabled'].every(key => typeof value[key] === 'boolean')
    && ['not_started', 'pending', 'restricted', 'ready'].includes(value.status)
    && Array.isArray(value.requirementsDue) && value.requirementsDue.every((item: unknown) => typeof item === 'string')
    && (value.restrictedReason === null || typeof value.restrictedReason === 'string')
    && (value.lastCheckedAt === null || (typeof value.lastCheckedAt === 'string' && Number.isFinite(Date.parse(value.lastCheckedAt))));
  if (!valid || (!value.connected && value.status !== 'not_started')
    || (value.status === 'ready' && (!value.connected || !value.detailsSubmitted || !value.payoutsEnabled
      || !value.transfersEnabled || value.restrictedReason || value.requirementsDue.length))) {
    throw new Error('Stripe account status could not be confirmed. Please retry.');
  }
  return { connected: value.connected, detailsSubmitted: value.detailsSubmitted, payoutsEnabled: value.payoutsEnabled,
    transfersEnabled: value.transfersEnabled, status: value.status, requirementsDue: value.requirementsDue,
    restrictedReason: value.restrictedReason, lastCheckedAt: value.lastCheckedAt };
}

export async function requestGuardStripe(client: any, endpoint: 'get-guard-stripe-status' | GuardStripeAction, userId: string,
  options: { baseUrl: string; publishableKey: string; fetcher?: typeof fetch }): Promise<any> {
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session?.access_token) throw new Error('Your session has expired. Please sign in again.');
  if (session.user?.id !== userId) throw new Error('Your account has changed. Please refresh this page.');
  const response = await (options.fetcher ?? fetch)(`${options.baseUrl}/functions/v1/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: options.publishableKey },
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => null);
  if (endpoint === 'get-guard-stripe-status' && data?.error_code === 'connect_account_unavailable') {
    throw new Error('Your linked Stripe account could not be verified. Contact support to check the connection; your existing account link has been kept.');
  }
  if (!response.ok || !data || data.error) throw new Error('Stripe could not complete this request. Please retry or contact support.');
  return endpoint === 'get-guard-stripe-status' ? parseGuardStripeStatus(data) : { url: stripeAccountUrl(data.url) };
}

export function stripeAccountUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Stripe did not return an account link. Please retry.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Stripe returned an invalid account link. Please retry.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || !['connect.stripe.com', 'dashboard.stripe.com'].includes(url.hostname)) {
    throw new Error('Stripe returned an invalid account link. Please retry.');
  }
  return url.href;
}

export function stripeReturnNotice(href: string): { notice: string; path: string } | null {
  const url = new URL(href);
  const result = url.searchParams.get('stripe_onboarding');
  if (result !== 'return' && result !== 'refresh') return null;
  url.searchParams.delete('stripe_onboarding');
  return { notice: result === 'return' ? 'Returned from Stripe. Check the current account status below.' : 'Stripe setup may still need information. Check your account status and continue setup if required.',
    path: url.pathname + url.search + url.hash };
}
