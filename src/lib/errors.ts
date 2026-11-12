/**
 * Texto de um erro qualquer (Error, erro do Supabase ou valor solto), com reserva.
 * Use em `catch (err)` no lugar de `err: any`.
 */
export function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  if (typeof err === 'string' && err) return err;
  return fallback;
}
