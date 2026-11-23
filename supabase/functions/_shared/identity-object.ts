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
