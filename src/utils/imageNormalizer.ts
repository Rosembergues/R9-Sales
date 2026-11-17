/**
 * Prepares images for e-mail: resizes to at most `maxDimension` (2× the 600px
 * layout, sharp on retina screens), picks the format clients support best and
 * compresses until the file is light enough to load fast on mobile data.
 *
 * - Photos and images without transparency → JPEG, quality lowered step by step
 *   until the file fits `targetBytes` (WebP is converted: Outlook can't show it).
 * - Images with transparency → PNG (JPEG would paint the transparent area black).
 * - Animated GIFs are kept untouched, since a canvas would freeze the animation.
 */

export interface NormalizedImage {
  dataUrl: string;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'gif' | 'original';
}

const DEFAULT_TARGET_BYTES = 300 * 1024;
const MIN_JPEG_QUALITY = 0.55;

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return dataUrl.length;
  const base64 = dataUrl.slice(comma + 1);
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Erro ao ler arquivo de imagem.')));
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem para normalização.'));
    img.src = src;
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    // Sampling every 4th pixel is enough to find a transparent background or logo edge.
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    // Tainted canvas (cross-origin image without CORS): assume transparency to stay safe.
    return true;
  }
}

export async function normalizeImageDetailed(
  fileOrUrl: File | string,
  maxDimension = 1200,
  targetBytes = DEFAULT_TARGET_BYTES,
): Promise<NormalizedImage> {
  const isFile = typeof fileOrUrl !== 'string';
  const source = isFile ? await readAsDataUrl(fileOrUrl) : fileOrUrl;
  const originalBytes = isFile ? fileOrUrl.size : dataUrlBytes(source);
  const passthrough = (format: NormalizedImage['format'] = 'original', width = 0, height = 0): NormalizedImage => ({
    dataUrl: source, originalBytes, finalBytes: originalBytes, width, height, format,
  });

  const isGif = isFile ? fileOrUrl.type === 'image/gif' : /^data:image\/gif/i.test(source) || /\.gif(\?|$)/i.test(source);
  if (isGif) return passthrough('gif');

  let img: HTMLImageElement;
  try {
    img = await loadImage(source);
  } catch (error) {
    if (!isFile) return passthrough();
    throw error;
  }

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (!width || !height) return passthrough();
  const resized = width > maxDimension || height > maxDimension;
  const originalType = isFile ? fileOrUrl.type : (source.match(/^data:(image\/[a-z]+)/i)?.[1] || '').toLowerCase();
  // Re-encoding an already small, unresized file can make it bigger: keep the original then.
  const keepIfSmaller = (result: NormalizedImage): NormalizedImage =>
    !resized && result.finalBytes >= originalBytes && originalType === `image/${result.format}`
      ? { ...passthrough(result.format, width, height) }
      : result;
  if (resized) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return passthrough();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  try {
    ctx.drawImage(img, 0, 0, width, height);
    if (hasTransparency(ctx, width, height)) {
      const png = canvas.toDataURL('image/png');
      return keepIfSmaller({ dataUrl: png, originalBytes, finalBytes: dataUrlBytes(png), width, height, format: 'png' });
    }

    // Opaque: flatten on white (defensive) and encode as JPEG.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    let quality = 0.85;
    let jpeg = canvas.toDataURL('image/jpeg', quality);
    while (dataUrlBytes(jpeg) > targetBytes && quality > MIN_JPEG_QUALITY) {
      quality = Math.max(MIN_JPEG_QUALITY, quality - 0.1);
      jpeg = canvas.toDataURL('image/jpeg', quality);
    }
    return keepIfSmaller({ dataUrl: jpeg, originalBytes, finalBytes: dataUrlBytes(jpeg), width, height, format: 'jpeg' });
  } catch (error) {
    // Cross-origin images can't be exported from a canvas; keep the original URL.
    if (!isFile) return passthrough();
    throw error;
  }
}

/** Backwards-compatible helper: returns only the optimized data URL. */
export async function normalizeImage(fileOrUrl: File | string, maxDimension = 1200): Promise<string> {
  return (await normalizeImageDetailed(fileOrUrl, maxDimension)).dataUrl;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
