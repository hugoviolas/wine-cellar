import { describe, it, expect } from 'vitest';
import { parisDay, parisYear } from './parisDate';

describe('parisDay', () => {
  it('donne le jour à Paris, pas le jour UTC', () => {
    expect(parisDay(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
    expect(parisDay(new Date('2026-01-10T12:00:00Z'))).toBe('2026-01-10');
  });

  it("passe à l'année suivante dès minuit à Paris", () => {
    expect(parisYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027);
  });
});
