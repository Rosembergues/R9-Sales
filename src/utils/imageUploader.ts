import { uploadImageToFirebaseStorage } from './firebaseStorage';

export interface UploadResult {
  url: string;
  isPublicUrl: boolean;
  message: string;
  isFirebase?: boolean;
  provider?: string;
  warning?: string;
}

export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * Validates image size/type before upload. Remote HTTPS URLs are accepted as-is.
 */
export function checkImageSize(
  fileOrBase64: File | string | null | undefined,
  maxMB = MAX_IMAGE_SIZE_MB
): { valid: boolean; sizeMB: number; message?: string } {
  if (!fileOrBase64) {
    return { valid: false, sizeMB: 0, message: 'Nenhum arquivo ou imagem foi fornecido para validação.' };
  }

  const maxBytes = maxMB * 1024 * 1024;

  try {
    if (typeof fileOrBase64 === 'string') {
      const trimmed = fileOrBase64.trim();
      if (/^https:\/\//i.test(trimmed)) return { valid: true, sizeMB: 0 };

      const match = trimmed.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
      if (!match || !ALLOWED_IMAGE_TYPES.has(match[1].toLowerCase())) {
        return {
          valid: false,
          sizeMB: 0,
          message: 'Formato de imagem não permitido. Use PNG, JPG, WEBP ou GIF.',
        };
      }

      const cleanBase64 = trimmed.slice(match[0].length).replace(/\s/g, '');
      const padding = (cleanBase64.match(/=/g) || []).length;
      const sizeInBytes = Math.max(0, (cleanBase64.length * 3) / 4 - padding);
      const sizeMB = sizeInBytes / (1024 * 1024);

      if (sizeInBytes > maxBytes) {
        return {
          valid: false,
          sizeMB,
          message: `A imagem possui ${sizeMB.toFixed(2)} MB, excedendo o limite máximo seguro de ${maxMB} MB por upload.`,
        };
      }
      return { valid: true, sizeMB };
    }

    if (!ALLOWED_IMAGE_TYPES.has(fileOrBase64.type.toLowerCase())) {
      return {
        valid: false,
        sizeMB: fileOrBase64.size / (1024 * 1024),
        message: 'Formato de imagem não permitido. Use PNG, JPG, WEBP ou GIF.',
      };
    }

    const sizeMB = fileOrBase64.size / (1024 * 1024);
    if (fileOrBase64.size > maxBytes) {
      return {
        valid: false,
        sizeMB,
        message: `A imagem possui ${sizeMB.toFixed(2)} MB, excedendo o limite máximo seguro de ${maxMB} MB por upload.`,
      };
    }

    return { valid: true, sizeMB };
  } catch {
    return { valid: false, sizeMB: 0, message: 'Não foi possível validar a imagem fornecida.' };
  }
}

/**
 * Upload pipeline: Firebase Storage is the only hosting provider.
 * External public image hosts were intentionally removed so user assets are
 * never silently copied to unrelated third-party services.
 */
export async function uploadImage(
  fileOrBase64: File | string | null | undefined,
  filename?: string
): Promise<UploadResult> {
  if (!fileOrBase64) {
    throw new Error('Nenhuma imagem fornecida para o upload.');
  }

  const validation = checkImageSize(fileOrBase64, MAX_IMAGE_SIZE_MB);
  if (!validation.valid) {
    throw new Error(validation.message || 'Validação da imagem falhou.');
  }

  if (typeof fileOrBase64 === 'string' && /^https:\/\//i.test(fileOrBase64.trim())) {
    const url = fileOrBase64.trim();
    return {
      url,
      isPublicUrl: true,
      isFirebase: /firebasestorage|googleapis\.com/i.test(url),
      provider: /firebasestorage|googleapis\.com/i.test(url) ? 'Firebase Storage' : 'URL Externa',
      message: 'A imagem já possui uma URL HTTPS segura.',
    };
  }

  try {
    const safeFilename = (filename || 'email_image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
    const result = await uploadImageToFirebaseStorage(fileOrBase64, safeFilename);

    if (!result.url || !/^https:\/\//i.test(result.url)) {
      throw new Error('O Firebase não retornou uma URL HTTPS válida para a imagem.');
    }

    return {
      url: result.url,
      isPublicUrl: true,
      isFirebase: true,
      provider: 'Firebase Storage',
      message: 'Imagem enviada com segurança para o Firebase Storage.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido no upload.';
    throw new Error(`Não foi possível hospedar a imagem no Firebase Storage. ${message}`);
  }
}
