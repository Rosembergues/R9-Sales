import { ref, uploadBytes, getDownloadURL, uploadString, SettableMetadata } from 'firebase/storage';
import { storage, ensureFirebaseAuth } from '../lib/firebase';

export interface FirebaseUploadResult {
  url: string;
  isFirebase: boolean;
  message: string;
}

/**
 * Uploads an image File or Base64 Data URL to Firebase Storage under the `/emails/` folder.
 * Times out after 6s if Firebase Storage hangs or is restricted, allowing smooth fallback.
 */
export async function uploadImageToFirebaseStorage(
  fileOrBase64: File | string,
  filename?: string
): Promise<FirebaseUploadResult> {
  // 1. Ensure user auth without blocking
  await ensureFirebaseAuth();

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  const metadata: SettableMetadata = {
    contentType: typeof fileOrBase64 === 'string' 
      ? (fileOrBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png')
      : fileOrBase64.type || 'image/png',
    cacheControl: 'public, max-age=31536000',
  };

  const uploadTask = async (): Promise<FirebaseUploadResult> => {
    if (typeof fileOrBase64 === 'string') {
      if (fileOrBase64.startsWith('http://') || fileOrBase64.startsWith('https://')) {
        return {
          url: fileOrBase64,
          isFirebase: fileOrBase64.includes('firebasestorage') || fileOrBase64.includes('googleapis.com'),
          message: 'A imagem já é uma URL pública HTTPS.'
        };
      }

      const cleanName = (filename || 'email_banner').replace(/[^a-zA-Z0-9]/g, '_');
      const storagePath = `emails/${timestamp}_${randomSuffix}_${cleanName}.png`;
      const storageRef = ref(storage, storagePath);

      // Format Base64 data_url if raw base64 string
      const dataUrl = fileOrBase64.startsWith('data:') 
        ? fileOrBase64 
        : `data:image/png;base64,${fileOrBase64}`;

      await uploadString(storageRef, dataUrl, 'data_url', metadata);
      const downloadUrl = await getDownloadURL(storageRef);

      return {
        url: downloadUrl,
        isFirebase: true,
        message: '🔥 Imagem enviada para o Firebase Storage (/emails/) com URL pública inserida no HTML!'
      };
    } else {
      const extension = fileOrBase64.name.split('.').pop() || 'png';
      const nameWithoutExt = fileOrBase64.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      const storagePath = `emails/${timestamp}_${randomSuffix}_${nameWithoutExt}.${extension}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, fileOrBase64, metadata);
      const downloadUrl = await getDownloadURL(storageRef);

      return {
        url: downloadUrl,
        isFirebase: true,
        message: '🔥 Imagem enviada com sucesso para o Firebase Storage (/emails/)! URL pública vinculada.'
      };
    }
  };

  // 2. Add 6s timeout so upload never hangs indefinitely
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Tempo limite do Firebase Storage excedido (6s).')), 6000);
  });

  return await Promise.race([uploadTask(), timeoutPromise]);
}
