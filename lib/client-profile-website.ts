const websiteError = 'Enter a complete http:// or https:// website, or leave it blank.';

export function normaliseOptionalWebsite(value: string): string {
  const text = value.trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) throw new Error(websiteError);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error(websiteError); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error(websiteError);
  return url.href;
}

export function profileWebsiteForForm(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  // Earlier forms used a bare scheme as an empty-field placeholder.
  if (!text || /^https?:\/\/$/i.test(text)) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  // Preserve support for complete domain names saved by older forms. Invalid
  // non-empty data stays visible for correction rather than being erased.
  try {
    const candidate = normaliseOptionalWebsite(`https://${text}`);
    if (!text.startsWith('/')) return candidate;
  } catch {}
  return text;
}
