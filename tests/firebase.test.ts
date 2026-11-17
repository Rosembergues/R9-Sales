import { describe, expect, it } from 'vitest';
import { getFirebaseConnectionErrorMessage } from '../src/lib/firebase';

describe('Firebase connection diagnostics', () => {
  it('reports permission failures as failures', () => {
    expect(getFirebaseConnectionErrorMessage({ code: 'permission-denied' })).toContain('não foi autorizada');
  });

  it('reports network failures as failures', () => {
    expect(getFirebaseConnectionErrorMessage({ message: 'client is offline' })).toContain('indisponível');
  });

  it('never converts unknown errors into a success state', () => {
    expect(getFirebaseConnectionErrorMessage(new Error('unexpected'))).toContain('Não foi possível');
  });
});
