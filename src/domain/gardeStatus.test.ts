import { describe, it, expect } from 'vitest';
import { computeGardeStatus, computeGardeProgress } from './gardeStatus';

describe('computeGardeStatus', () => {
  it('retourne "unknown" si la fenetre n\'est pas connue', () => {
    expect(computeGardeStatus(null, null, 2026)).toBe('unknown');
  });

  it('retourne "too_young" avant le debut de la fenetre', () => {
    expect(computeGardeStatus(2028, 2035, 2026)).toBe('too_young');
  });

  it('retourne "ready" au milieu de la fenetre', () => {
    expect(computeGardeStatus(2020, 2032, 2026)).toBe('ready');
  });

  it('retourne "closing_window" a 2 ans ou moins de la fin', () => {
    expect(computeGardeStatus(2020, 2028, 2026)).toBe('closing_window');
  });

  it('retourne "closing_window" apres la fin de la fenetre', () => {
    expect(computeGardeStatus(2010, 2020, 2026)).toBe('closing_window');
  });
});

describe('computeGardeProgress', () => {
  it('retourne 0 si les bornes sont inconnues', () => {
    expect(computeGardeProgress(null, null, 2026)).toBe(0);
  });

  it('retourne une valeur entre 0 et 1 au milieu de la fenetre', () => {
    const progress = computeGardeProgress(2015, 2035, 2025);
    expect(progress).toBeCloseTo(0.5, 1);
  });

  it('clampe a 1 apres la fin de la fenetre', () => {
    expect(computeGardeProgress(2015, 2020, 2030)).toBe(1);
  });

  it('clampe a 0 avant le millesime', () => {
    expect(computeGardeProgress(2020, 2035, 2015)).toBe(0);
  });
});
