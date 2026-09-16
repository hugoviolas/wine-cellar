import { describe, it, expect } from 'vitest';
import { computeGardeStatus, computeGardeProgress } from './gardeStatus';

describe('computeGardeStatus', () => {
  it('retourne "unknown" si la fenetre n\'est pas connue', () => {
    expect(computeGardeStatus({ drinkFrom: null, drinkUntil: null, currentYear: 2026 })).toBe('unknown');
  });

  it('retourne "too_young" avant le debut de la fenetre', () => {
    expect(computeGardeStatus({ drinkFrom: 2028, drinkUntil: 2035, currentYear: 2026 })).toBe('too_young');
  });

  it('retourne "ready" au milieu de la fenetre', () => {
    expect(computeGardeStatus({ drinkFrom: 2020, drinkUntil: 2032, currentYear: 2026 })).toBe('ready');
  });

  it('retourne "closing_window" a 2 ans ou moins de la fin', () => {
    expect(computeGardeStatus({ drinkFrom: 2020, drinkUntil: 2028, currentYear: 2026 })).toBe(
      'closing_window',
    );
  });

  it('retourne "closing_window" apres la fin de la fenetre', () => {
    expect(computeGardeStatus({ drinkFrom: 2010, drinkUntil: 2020, currentYear: 2026 })).toBe(
      'closing_window',
    );
  });

  it('ne signale pas "fin de fenetre" au milieu d\'une fenetre courte (ex. fenetre IA de 4 ans)', () => {
    // Cas reel : Clos Poggiale 2023, fenetre IA 2024-2028, aujourd'hui 2026 —
    // le seuil fixe de 2 ans declenchait a tort "fin de fenetre" a mi-parcours
    // d'une fenetre de seulement 4 ans.
    expect(computeGardeStatus({ drinkFrom: 2024, drinkUntil: 2028, currentYear: 2026 })).toBe('ready');
  });

  it('signale "closing_window" pres de la fin d\'une fenetre courte', () => {
    expect(computeGardeStatus({ drinkFrom: 2024, drinkUntil: 2028, currentYear: 2027 })).toBe(
      'closing_window',
    );
  });
});

describe('computeGardeProgress', () => {
  it('retourne 0 si les bornes sont inconnues', () => {
    expect(computeGardeProgress({ vintage: null, drinkUntil: null, currentYear: 2026 })).toBe(0);
  });

  it('retourne une valeur entre 0 et 1 au milieu de la fenetre', () => {
    const progress = computeGardeProgress({ vintage: 2015, drinkUntil: 2035, currentYear: 2025 });
    expect(progress).toBeCloseTo(0.5, 1);
  });

  it('clampe a 1 apres la fin de la fenetre', () => {
    expect(computeGardeProgress({ vintage: 2015, drinkUntil: 2020, currentYear: 2030 })).toBe(1);
  });

  it('clampe a 0 avant le millesime', () => {
    expect(computeGardeProgress({ vintage: 2020, drinkUntil: 2035, currentYear: 2015 })).toBe(0);
  });
});
