export interface ServiceHealth {
  status: 'healthy' | 'configured' | 'not_configured' | 'access_denied' | 'invalid_credentials' | 'rate_limited' | 'unhealthy' | 'unknown';
  provider?: string;
  latency_ms?: number;
  http_status?: number;
  error?: string;
}

export function emailConfiguration(env: (name: string) => string | undefined): ServiceHealth {
  if (env('RESEND_API_KEY')) return { status: 'configured', provider: 'Resend API' };
  if (env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS')) return { status: 'configured', provider: 'SMTP' };
  return { status: 'not_configured', provider: 'Email', error: 'No complete email provider configuration is available.' };
}

/** Read-only authenticated probe; configuration and permissions are not an outage. */
export async function stripeHealth(key: string | undefined, request: typeof fetch = fetch): Promise<ServiceHealth> {
  if (!key) return { status: 'not_configured', provider: 'Stripe' };
  const start = Date.now();
  try {
    const response = await request('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
    });
    const base = { provider: 'Stripe', http_status: response.status, latency_ms: Date.now() - start };
    if (response.ok) return { ...base, status: 'healthy' };
    if (response.status === 401) return { ...base, status: 'invalid_credentials', error: 'Stripe rejected the configured credential. Check the key and environment.' };
    if (response.status === 403) return { ...base, status: 'access_denied', error: 'The configured key cannot read balance health. Check its permissions; this does not establish a Stripe outage.' };
    if (response.status === 429) return { ...base, status: 'rate_limited', error: 'Stripe rate-limited this health probe.' };
    return { ...base, status: response.status >= 500 ? 'unhealthy' : 'unknown', error: `Stripe health probe returned HTTP ${response.status}.` };
  } catch {
    return { provider: 'Stripe', status: 'unknown', latency_ms: Date.now() - start, error: 'Stripe health probe could not be completed.' };
  }
}
