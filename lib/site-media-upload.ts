// Browser conversion is a convenience only. The staging endpoint still
// independently validates, decodes and re-encodes every PNG it receives.
export const MEDIA_INPUT_TYPES = ['image/png','image/jpeg','image/webp','image/avif'] as const;
const MAX = 10 * 1024 * 1024;

export async function normalizeMediaUpload(file: File): Promise<Blob> {
  if (!MEDIA_INPUT_TYPES.some(type => type === file.type) || file.size === 0 || file.size > MAX) {
    throw new Error('Select a PNG, JPEG, WebP or AVIF image up to 10 MB.');
  }
  if (file.type === 'image/png') return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This browser could not decode the selected image. Try PNG instead.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 8000000) {
      throw new Error('Image exceeds the 8 megapixel decoding limit.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion unavailable.');
    context.drawImage(bitmap,0,0);
    const result = await new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image conversion failed.')), 'image/png'));
    if (result.size > MAX) throw new Error('Converted PNG exceeds 10 MB. Resize the image and retry.');
    return result;
  } finally { bitmap.close(); }
}
