import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('auth', () => {
  it('vérifie un mot de passe correct', async () => {
    const hash = await hashPassword('mon-mot-de-passe');
    expect(await verifyPassword('mon-mot-de-passe', hash)).toBe(true);
  });

  it('rejette un mot de passe incorrect', async () => {
    const hash = await hashPassword('mon-mot-de-passe');
    expect(await verifyPassword('autre-chose', hash)).toBe(false);
  });

  it('génère un hash différent à chaque appel (salage)', async () => {
    const hash1 = await hashPassword('mon-mot-de-passe');
    const hash2 = await hashPassword('mon-mot-de-passe');
    expect(hash1).not.toBe(hash2);
  });
});
