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

  it('ne signale pas "fin de fenetre" au milieu d\'une fenetre courte (ex. fenetre IA de 4 ans)', () => {
    // Cas reel : Clos Poggiale 2023, fenetre IA 2024-2028, aujourd'hui 2026 —
    // le seuil fixe de 2 ans declenchait a tort "fin de fenetre" a mi-parcours
    // d'une fenetre de seulement 4 ans.
    expect(computeGardeStatus(2024, 2028, 2026)).toBe('ready');
  });

  it('signale "closing_window" pres de la fin d\'une fenetre courte', () => {
    expect(computeGardeStatus(2024, 2028, 2027)).toBe('closing_window');
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
