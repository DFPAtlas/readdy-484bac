export const ADMIN_EDGE_FUNCTIONS = [
  { name: 'Create Job Payment', slug: 'create-job-payment', type: 'payment', probe: 'get' },
  { name: 'Create Guard Payout', slug: 'create-guard-payout', type: 'payment', probe: 'get' },
  { name: 'Release Guard Payment', slug: 'release-guard-payment', type: 'payment', probe: 'retired' },
  { name: 'Overdue Guard Payout Worker', slug: 'process-overdue-guard-payouts', type: 'payment', probe: 'server_only' },
  { name: 'Enhanced Stripe Webhook', slug: 'enhanced-stripe-webhook', type: 'stripe', probe: 'get' },
  { name: 'Get Storage Usage', slug: 'get-storage-usage', type: 'storage', probe: 'get' },
  { name: 'Admin Cleanup', slug: 'admin-run-cleanup', type: 'maintenance', probe: 'get' },
] as const;

export type AdminEdgeStatus = 'reachable' | 'protected' | 'not_found' | 'rate_limited' | 'degraded' | 'unknown' | 'retired' | 'server_only';
export interface AdminEdgePing {
  slug: string;
  status: AdminEdgeStatus;
  latency: number | null;
  httpStatus: number | null;
  checkedAt: string | null;
  detail: string;
}

export function edgeStatusBadge(status: AdminEdgeStatus | undefined) {
  switch (status) {
    case 'reachable': return { label: 'Reachable', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'protected': return { label: 'Protected', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    case 'retired': return { label: 'Retired', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    case 'server_only': return { label: 'Server only', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    case 'not_found': return { label: 'Not found', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'rate_limited': return { label: 'Rate limited', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'degraded': return { label: 'Error response', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    default: return { label: 'Not verified', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  }
}

/** Unauthenticated GET reachability only. Never invoke a payment or scheduler action. */
export async function loadAdminEdgePings(
  baseUrl: string,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
  timeoutMs = 8000,
): Promise<AdminEdgePing[]> {
  return Promise.all(ADMIN_EDGE_FUNCTIONS.map(async (fn): Promise<AdminEdgePing> => {
    const unprobed = { slug: fn.slug, latency: null, httpStatus: null, checkedAt: null };
    if (fn.probe === 'retired') return { ...unprobed, status: 'retired',
      detail: 'Legacy route excluded from active checks. Payouts use Create Guard Payout.' };
    if (fn.probe === 'server_only') return { ...unprobed, status: 'server_only',
      detail: 'Not invoked by this page. See Scheduled Jobs for dispatch history; worker completion is not verified here.' };

    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timeout = setTimeout(cancel, timeoutMs);
    const start = performance.now();
    try {
      if (controller.signal.aborted) throw new Error('Cancelled');
      const response = await request(`${baseUrl.replace(/\/$/, '')}/functions/v1/${fn.slug}`, {
        method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
      });
      const code = response.status;
      const observed = { slug: fn.slug, latency: Math.round(performance.now() - start), httpStatus: code,
        checkedAt: new Date().toISOString() };
      if (code === 401 || code === 403) return { ...observed, status: 'protected',
        detail: 'Unauthenticated request rejected. Authorised operation is not tested.' };
      if (code === 404 || code === 410) return { ...observed, status: 'not_found',
        detail: 'Active endpoint is missing or unavailable. Check its deployment.' };
      if (code === 429) return { ...observed, status: 'rate_limited', detail: 'The endpoint rate-limited this probe.' };
      if (code >= 500) return { ...observed, status: 'degraded', detail: 'The endpoint returned a server error.' };
      if ((code >= 200 && code < 300) || code === 400 || code === 405) return { ...observed, status: 'reachable',
        detail: 'Endpoint response only. Payment, webhook and worker execution are not tested.' };
      return { ...observed, status: 'unknown', detail: 'Unexpected response; endpoint health is not verified.' };
    } catch {
      return { slug: fn.slug, status: 'unknown', latency: null, httpStatus: null, checkedAt: new Date().toISOString(),
        detail: 'No readable response. Browser access, network or timeout prevented verification.' };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    }
  }));
}
