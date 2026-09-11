import { describe, it, expect } from 'vitest';
import { generateToken } from './token';

describe('generateToken', () => {
  it('génère une chaîne hexadécimale de 64 caractères (32 octets)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('génère un token différent à chaque appel', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
