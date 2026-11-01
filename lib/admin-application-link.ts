const KEY = 'qg_admin_application_return';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseApplicationLink(path: string): { role: 'client' | 'guard'; id: string } | null {
  if (!path.startsWith('/admin/accounts?') || path.includes('\\')) return null;
  const url = new URL(path, 'https://quickguard.uk');
  if (url.pathname !== '/admin/accounts') return null;
  const role = url.searchParams.get('role');
  const id = url.searchParams.get('id') || '';
  return (role === 'client' || role === 'guard') && UUID.test(id) ? { role, id } : null;
}

export function rememberApplicationLink(): void {
  if (typeof window === 'undefined') return;
  const link = parseApplicationLink(window.location.pathname + window.location.search);
  if (link) {
    try { sessionStorage.setItem(KEY, `/admin/accounts?role=${link.role}&id=${link.id}`); } catch {}
  }
}

export function takeApplicationReturnPath(): string {
  if (typeof window === 'undefined') return '/admin/dashboard';
  try {
    const value = sessionStorage.getItem(KEY) || '';
    sessionStorage.removeItem(KEY);
    const link = parseApplicationLink(value);
    if (link) return `/admin/accounts?role=${link.role}&id=${link.id}`;
  } catch {}
  return '/admin/dashboard';
}
