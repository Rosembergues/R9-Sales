import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

/**
 * Ensures user is authenticated (anonymously if enabled) for Firebase Storage permissions.
 * Never blocks longer than 1.5s or crashes if anonymous auth is restricted.
 */
export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const authPromise = signInAnonymously(auth)
      .then((cred) => cred.user)
      .catch((err) => {
        // Ignora o erro admin-restricted-operation sem travar a interface
        console.warn('Autenticação anônima do Firebase desativada ou restrita:', err?.message || err);
        return null;
      });

    return await Promise.race([authPromise, timeoutPromise]);
  } catch (e) {
    return null;
  }
}

export function getFirebaseConnectionErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();

  if (code.includes('permission-denied') || message.includes('permission-denied')) {
    return 'O Firebase respondeu, mas a operação não foi autorizada.';
  }
  if (code.includes('unauthenticated') || message.includes('unauthenticated')) {
    return 'A autenticação do Firebase não foi concluída.';
  }
  if (code.includes('unavailable') || message.includes('offline') || message.includes('network')) {
    return 'O Firebase está indisponível ou sem conexão de rede.';
  }
  return 'Não foi possível confirmar a conexão com o Firebase.';
}

/**
 * Tests connection to Firebase Firestore & Auth
 */
export async function testFirebaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const user = await ensureFirebaseAuth();
    if (!user) {
      return { ok: false, message: 'Não foi possível autenticar no Firebase.' };
    }

    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, message: 'Conexão com o Firebase estabelecida com sucesso!' };
  } catch (error: unknown) {
    return { ok: false, message: getFirebaseConnectionErrorMessage(error) };
  }
}
