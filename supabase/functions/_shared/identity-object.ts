export const bucket = 'guard-documents';

export interface ObjectReference {
  path: string;
  id: string;
  version: string;
  etag: string | null;
  sha256?: string;
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;


export async function matchesCapturedDocument(data: ArrayBuffer, captured: string, current: string | null) {
  return data.byteLength > 0 && data.byteLength <= MAX_DOCUMENT_SIZE &&
    /^[0-9a-f]{64}$/.test(captured) && current === captured && await sha256(data) === captured;
}

export async function readBrokerBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(1024);
  let offset = 0;
  let timer: number | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request body timeout')), 5000);
    });
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      if (offset + value.length > bytes.length) return null;
      bytes.set(value, offset);
      offset += value.length;
    }
    const data = JSON.parse(new TextDecoder().decode(bytes.subarray(0, offset)));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
