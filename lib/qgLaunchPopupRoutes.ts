export const QG_POPUP_EXCLUDED_PREFIXES = [
  '/admin',
  '/dashboard',
  '/checkout',
  '/payment',
  '/auth',
  '/subscription',
];

export const QG_POPUP_EXCLUDED_PATHS = [
  '/guard/login',
  '/guard/forgot-password',
  '/guard/reset-password',
  '/guard/register',
  '/client/login',
  '/client/forgot-password',
  '/client/reset-password',
  '/client/register',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/qg-launch-rewards/temporary-profile',
];

export function isQGPopupAllowedPath(pathname: string): boolean {
  if (!pathname) return false;

  const normalized = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  if (QG_POPUP_EXCLUDED_PATHS.includes(normalized)) return false;

  for (const prefix of QG_POPUP_EXCLUDED_PREFIXES) {
    if (normalized.startsWith(prefix)) return false;
  }

  return true;
}