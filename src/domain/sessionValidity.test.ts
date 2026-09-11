import { describe, it, expect } from 'vitest';
import { isSessionStillValid } from './sessionValidity';

describe('isSessionStillValid', () => {
  it('accepte toute session d’un compte jamais invalidé', () => {
    expect(isSessionStillValid({ sessionsValidFrom: null }, '2020-01-01T00:00:00.000Z')).toBe(true);
  });

  it('accepte une session sans date si le compte n’a jamais été invalidé', () => {
    // Cas des sessions déjà ouvertes au moment du déploiement : elles ne
    // portent pas encore d'issuedAt et ne doivent pas être cassées.
    expect(isSessionStillValid({ sessionsValidFrom: null }, undefined)).toBe(true);
  });

  it('refuse une session émise avant la réinitialisation', () => {
    expect(
      isSessionStillValid(
        { sessionsValidFrom: '2026-09-11T12:00:00.000Z' },
        '2026-09-11T11:59:59.000Z',
      ),
    ).toBe(false);
  });

  it('accepte une session émise après la réinitialisation', () => {
    expect(
      isSessionStillValid(
        { sessionsValidFrom: '2026-09-11T12:00:00.000Z' },
        '2026-09-11T12:00:01.000Z',
      ),
    ).toBe(true);
  });

  it('accepte une session émise exactement à la date d’invalidation', () => {
    const at = '2026-09-11T12:00:00.000Z';
    expect(isSessionStillValid({ sessionsValidFrom: at }, at)).toBe(true);
  });

  it('refuse une session sans date sur un compte invalidé', () => {
    expect(isSessionStillValid({ sessionsValidFrom: '2026-09-11T12:00:00.000Z' }, undefined)).toBe(
      false,
    );
  });

  it('refuse une date illisible plutôt que de la laisser passer', () => {
    // `new Date('nawak').getTime()` vaut NaN, et toute comparaison avec NaN
    // est fausse — sans garde explicite, un `issued >= validFrom` renverrait
    // false ici par accident plutôt que par décision.
    expect(isSessionStillValid({ sessionsValidFrom: '2026-09-11T12:00:00.000Z' }, 'nawak')).toBe(
      false,
    );
    expect(isSessionStillValid({ sessionsValidFrom: 'nawak' }, '2026-09-11T12:00:00.000Z')).toBe(
      false,
    );
  });
});
