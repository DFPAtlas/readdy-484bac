// Authorisation for backend-only promotional endpoints (finding 9).
// Accepts the service-role bearer (constant-time comparison) or, failing that, a
// token the supplied verifier confirms belongs to an active administrator.

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export interface PromoAuthResult { ok: boolean; caller?: 'service' | 'admin'; status?: number; error?: string }

export async function authorizePromoCaller(
  authorization: string | null,
  serviceRoleKey: string,
  isActiveAdmin: (token: string) => Promise<boolean>,
): Promise<PromoAuthResult> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'Authentication required' };
  if (serviceRoleKey && timingSafeEqual(token, serviceRoleKey)) return { ok: true, caller: 'service' };
  let admin = false;
  try { admin = await isActiveAdmin(token); } catch { admin = false; }
  return admin ? { ok: true, caller: 'admin' } : { ok: false, status: 403, error: 'Administrator access required' };
}
