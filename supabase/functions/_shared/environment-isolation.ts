export const QUICKGUARD_SANDBOX_URL = 'https://alfwwggavmyerjyqumuo.supabase.co';
export const QUICKGUARD_SANDBOX_ORIGIN = 'https://quickguard-e2e-sandbox.martin-s-hewett.chatgpt.site';

export function isQuickGuardSandbox(projectUrl: string): boolean {
  try { return new URL(projectUrl).origin === QUICKGUARD_SANDBOX_URL; } catch { return false; }
}

export function activationOrigin(projectUrl: string, configuredAppUrl?: string): string {
  if (!isQuickGuardSandbox(projectUrl)) return 'https://quickguard.uk';
  const app = new URL(configuredAppUrl || '');
  if (app.origin !== QUICKGUARD_SANDBOX_ORIGIN || app.pathname !== '/' || app.search || app.hash || app.username || app.password) {
    throw new Error('Sandbox activation destination is not configured');
  }
  return app.origin;
}

export function sandboxRecipientAllowed(projectUrl: string, recipients: string[], rawAllowlist?: string): boolean {
  if (!isQuickGuardSandbox(projectUrl)) return true;
  try {
    const values: unknown = JSON.parse(rawAllowlist || '');
    if (!Array.isArray(values) || !values.length || values.length > 20
        || values.some(value => typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return false;
    const allowed = new Set(values.map(value => String(value).trim().toLowerCase()));
    return recipients.length > 0 && recipients.every(value => allowed.has(value.trim().toLowerCase()));
  } catch { return false; }
}

export function stripeEventMatchesEnvironment(projectUrl: string, key: string, livemode: unknown): boolean {
  const mode = /^(?:sk|rk)_(live|test)_/.exec(key)?.[1];
  if (!mode || typeof livemode !== 'boolean') return false;
  if (isQuickGuardSandbox(projectUrl) && (mode !== 'test' || livemode)) return false;
  return livemode === (mode === 'live');
}

export function stripeAppOrigin(projectUrl: string, key: string, configuredAppUrl: string | undefined, legacyOrigin: string): string {
  if (!isQuickGuardSandbox(projectUrl)) return legacyOrigin;
  if (!stripeEventMatchesEnvironment(projectUrl, key, false)) throw new Error('Sandbox Stripe test mode is not configured');
  return activationOrigin(projectUrl, configuredAppUrl);
}
