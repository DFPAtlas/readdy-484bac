export class GuardListError extends Error {
  constructor(message = 'Unable to load guard applications. Please retry.', readonly signIn = false) {
    super(message);
  }
}

interface GuardListRequest {
  status: string;
  incompleteOnly?: boolean;
  token: string;
  signal?: AbortSignal;
}

interface GuardPage<T> {
  success: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  count: number;
  data: T[];
}

const REQUEST_PAGE_SIZE = 100;
export const GUARD_DISPLAY_PAGE_SIZE = 25;

async function requestPage<T extends { id: string }>(request: GuardListRequest, page: number, pageSize: number): Promise<GuardPage<T>> {
  if (!request.token) throw new GuardListError('Your admin session has expired. Sign in again to review guards.', true);
  request.signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${request.token}`,
      },
      body: JSON.stringify({ status: request.status, incompleteOnly: request.incompleteOnly === true, page, pageSize }),
      signal: controller.signal,
    });
    if (response.status === 401) throw new GuardListError('Your admin session has expired. Sign in again to review guards.', true);
    if (response.status === 403) throw new GuardListError('Unable to verify your admin access. Sign in again and complete MFA.', true);
    if (!response.ok) throw new GuardListError();
    // Guard fields retain the existing endpoint DTO. Validate the paging envelope
    // and identities before any caller can treat a partial response as complete.
    const result: GuardPage<T> = await response.json();
    if (!result || result.success !== true || result.page !== page || result.pageSize !== pageSize ||
      !Number.isSafeInteger(result.totalCount) || result.totalCount < 0 ||
      !Array.isArray(result.data) || result.count !== result.data.length ||
      result.data.length !== Math.min(pageSize, Math.max(0, result.totalCount - (page - 1) * pageSize)) ||
      result.data.some(guard => !guard || typeof guard !== 'object' || typeof guard.id !== 'string' || !guard.id)) {
      throw new GuardListError();
    }
    controller.signal.throwIfAborted();
    request.signal?.throwIfAborted();
    return result;
  } catch (error) {
    request.signal?.throwIfAborted();
    if (error instanceof GuardListError) throw error;
    throw new GuardListError();
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener('abort', abort);
  }
}

// Load all bounded API pages before publishing the list. Existing search and
// local subscriber filters must cover every record, not just the first page.
export async function loadAdminGuardList<T extends { id: string }>(request: GuardListRequest): Promise<T[]> {
  const first = await requestPage<T>(request, 1, REQUEST_PAGE_SIZE);
  const totalPages = Math.ceil(first.totalCount / REQUEST_PAGE_SIZE);
  if (totalPages > 1000000) throw new GuardListError(); // Endpoint's supported page range.
  const guards: T[] = [];
  const ids = new Set<string>();
  const append = (page: GuardPage<T>) => {
    if (page.totalCount !== first.totalCount) throw new GuardListError('The guard list changed while loading. Please retry.');
    for (const guard of page.data) {
      if (ids.has(guard.id)) throw new GuardListError('The guard list changed while loading. Please retry.');
      ids.add(guard.id);
      guards.push(guard);
    }
  };
  append(first);
  for (let page = 2; page <= totalPages; page++) append(await requestPage<T>(request, page, REQUEST_PAGE_SIZE));
  return guards;
}

export async function loadAdminGuardCount(request: GuardListRequest): Promise<number> {
  return (await requestPage<{ id: string }>(request, 1, 1)).totalCount;
}

export function guardDisplayPage<T>(items: T[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / GUARD_DISPLAY_PAGE_SIZE));
  const page = Math.max(1, Math.min(totalPages, requestedPage));
  return { page, totalPages, items: items.slice((page - 1) * GUARD_DISPLAY_PAGE_SIZE, page * GUARD_DISPLAY_PAGE_SIZE) };
}
