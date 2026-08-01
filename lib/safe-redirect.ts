const BLOCKED_PATTERNS = [
  /\/admin\/guard(-|_)?test/i,
  /\/admin\/test(-|_)?guard/i,
  /\/admin\/guards\/test/i,
  /\/admin\/guard-test/i,
  /\/admin\/test-guard/i,
  /\/test\//i,
  /\/debug\//i,
];

const ALLOWED_GUARD_PREFIXES = ['/guard/', '/guard?', '/jobs/', '/contact', '/pricing', '/upgrade', '/how-it-works', '/help', '/find-a-guard', '/security-guards', '/guide/guard', '/subscription/success', '/payment/', '/privacy', '/terms', '/cookie-policy', '/maintenance', '/accessibility', '/mobile-app/', '/post-job'];
const ALLOWED_CLIENT_PREFIXES = ['/client/', '/client?', '/jobs/', '/contact', '/pricing', '/upgrade', '/how-it-works', '/help', '/find-a-guard', '/security-guards', '/guide/client', '/subscription/success', '/payment/', '/privacy', '/terms', '/cookie-policy', '/maintenance', '/accessibility', '/mobile-app/', '/post-job', '/company/'];
const ALLOWED_ADMIN_PREFIXES = ['/admin/', '/admin?'];

export function sanitizeRedirectPath(path: string, userType: 'guard' | 'client' | 'admin', fallback?: string): string {
  if (!path || typeof path !== 'string') return getDefaultRedirect(userType, fallback);

  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
    return getDefaultRedirect(userType, fallback);
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(path)) {
      return getDefaultRedirect(userType, fallback);
    }
  }

  if (path.startsWith('/admin/')) {
    if (userType !== 'admin') return getDefaultRedirect(userType, fallback);
    return path;
  }

  const allowedPrefixes = userType === 'guard' ? ALLOWED_GUARD_PREFIXES :
    userType === 'client' ? ALLOWED_CLIENT_PREFIXES :
    ALLOWED_ADMIN_PREFIXES;

  for (const prefix of allowedPrefixes) {
    if (path.startsWith(prefix) || path === prefix.replace(/\/$/, '')) {
      return path;
    }
  }

  return getDefaultRedirect(userType, fallback);
}

function getDefaultRedirect(userType: 'guard' | 'client' | 'admin', fallback?: string): string {
  if (fallback) return fallback;
  if (userType === 'guard') return '/guard/dashboard';
  if (userType === 'client') return '/client/dashboard';
  return '/admin/dashboard';
}

export function getGuardPostApprovalRedirect(verificationStatus: string, profileCompleted: boolean): string {
  if (!profileCompleted) return '/guard/complete-profile-wizard';
  if (verificationStatus === 'approved' || verificationStatus === 'verified') return '/guard/dashboard';
  if (verificationStatus === 'rejected') return '/guard/verification-failed';
  return '/guard/onboarding';
}

export function clearBadStoredRedirects() {
  if (typeof window === 'undefined') return;
  const stored = sessionStorage.getItem('post_auth_redirect');
  if (stored) {
    if (stored.startsWith('/admin/') || stored.includes('test') || stored.includes('debug')) {
      sessionStorage.removeItem('post_auth_redirect');
    }
  }
}