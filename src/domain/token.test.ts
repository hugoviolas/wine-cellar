import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from './token';

describe('generateToken', () => {
  it('génère une chaîne hexadécimale de 64 caractères (32 octets)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('génère un token différent à chaque appel', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('hashToken', () => {
  it('produit une empreinte hexadécimale de 64 caractères', () => {
    expect(hashToken(generateToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('donne toujours la même empreinte pour un même jeton', () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('ne laisse pas retrouver le jeton dans son empreinte', () => {
    const token = generateToken();
    expect(hashToken(token)).not.toBe(token);
  });

  it('donne des empreintes différentes pour des jetons différents', () => {
    expect(hashToken(generateToken())).not.toBe(hashToken(generateToken()));
  });
});
