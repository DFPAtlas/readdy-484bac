const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

/**
 * Treat the supplied target as the root of the application under test.
 * Readdy preview URLs include a path prefix, so the trailing slash matters
 * when resolving routes relative to that target.
 *
 * @param {string} value
 */
function normalizeBaseURL(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

/**
 * Resolve an application-root route without discarding a Readdy preview
 * prefix. Preserve a query token from the preview URL when the route does not
 * provide its own query string.
 *
 * @param {string} path
 * @param {string} [baseURL]
 */
function appUrl(path, baseURL = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL) {
  if (!path.startsWith('/')) {
    throw new Error(`Application paths must start with "/": ${path}`);
  }

  const base = new URL(normalizeBaseURL(baseURL));
  const resolved = new URL(path === '/' ? './' : `.${path}`, base);
  if (!resolved.search && base.search) resolved.search = base.search;
  return resolved.toString();
}

module.exports = { appUrl, normalizeBaseURL };
