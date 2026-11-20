export const CLIENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CLIENT_DOCUMENT_TYPES = ['insurance', 'purchase_order', 'site_instructions', 'authorisation_letter', 'contract', 'other'] as const;
export const CLIENT_DOCUMENT_FIELDS = 'id, client_id, document_type, file_name, file_size, mime_type, description, expiry_date, created_at';
export const DOCUMENT_MIMES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
export function documentFileType(name: string, mime: string): { extension: string; mime: string } {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200 || /[\x00-\x1f\x7f/\\]/.test(name)) throw new Error('Choose a file with a valid name.');
  const extension = name.toLowerCase().split('.').pop() || '';
  if (!Object.hasOwn(DOCUMENT_MIMES, extension) || (mime && mime !== DOCUMENT_MIMES[extension])) throw new Error('Choose a PDF, Word, PNG or JPEG file.');
  return { extension, mime: DOCUMENT_MIMES[extension] };
}
export function documentDetails(type: string, description: string, expiry: string) {
  if (!CLIENT_DOCUMENT_TYPES.includes(type as typeof CLIENT_DOCUMENT_TYPES[number]) || typeof description !== 'string' || description.length > 4000 || typeof expiry !== 'string') throw new Error('Review the document details.');
  if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(Date.parse(expiry)) || new Date(expiry).toISOString().slice(0, 10) !== expiry)) throw new Error('Enter a valid expiry date or leave it blank.');
  return { document_type: type, description: description.trim(), expiry_date: expiry || null };
}