const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

export function appUrl(path: string, baseURL = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL) {
  const normalizedBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  const relativePath = path.replace(/^\/+/, '');

  return new URL(relativePath, normalizedBase).toString();
}
