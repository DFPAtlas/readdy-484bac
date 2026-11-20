export function paymentDocumentLink(value: unknown, kind: 'receipt' | 'invoice'): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    const hosts = kind === 'receipt' ? ['pay.stripe.com', 'receipt.stripe.com'] : ['invoice.stripe.com', 'pay.stripe.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}