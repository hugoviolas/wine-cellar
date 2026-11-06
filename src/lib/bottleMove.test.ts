import { describe, it, expect } from 'vitest';
import { applyBottleMove, bottleMoveMessage } from './bottleMove';

const margaux = { id: 'm', name: 'Margaux', quantity: 6 };
const other = { id: 'o', name: 'Autre', quantity: 1 };

describe('applyBottleMove', () => {
  it('scinde un lot vers une clayette sans ce vin', () => {
    const next = applyBottleMove({
      bottlesByCrate: { a: [margaux], b: [other] },
      bottle: margaux,
      fromCrateId: 'a',
      toCrateId: 'b',
      quantity: 2,
      result: { bottleId: 'm2', merged: false },
    });

    expect(next).toEqual({
      a: [{ ...margaux, quantity: 4 }],
      b: [other, { ...margaux, id: 'm2', quantity: 2 }],
    });
  });

  it('déplace un lot entier', () => {
    const next = applyBottleMove({
      bottlesByCrate: { a: [margaux], b: [] },
      bottle: margaux,
      fromCrateId: 'a',
      toCrateId: 'b',
      quantity: 6,
      result: { bottleId: 'm', merged: false },
    });

    expect(next).toEqual({ a: [], b: [margaux] });
  });

  it('fusionne avec le lot existant et fait disparaître le lot vidé', () => {
    const existing = { id: 'm3', name: 'Margaux', quantity: 3 };
    const bottlesByCrate = { a: [margaux], b: [existing, other] };

    const partial = applyBottleMove({
      bottlesByCrate,
      bottle: margaux,
      fromCrateId: 'a',
      toCrateId: 'b',
      quantity: 2,
      result: { bottleId: 'm3', merged: true },
    });
    expect(partial).toEqual({ a: [{ ...margaux, quantity: 4 }], b: [{ ...existing, quantity: 5 }, other] });

    const full = applyBottleMove({
      bottlesByCrate,
      bottle: margaux,
      fromCrateId: 'a',
      toCrateId: 'b',
      quantity: 6,
      result: { bottleId: 'm3', merged: true },
    });
    expect(full).toEqual({ a: [], b: [{ ...existing, quantity: 9 }, other] });
    expect(bottlesByCrate.a).toEqual([margaux]);
  });
});

describe('bottleMoveMessage', () => {
  it('accorde et distingue fusion et déplacement simple', () => {
    expect(bottleMoveMessage({ quantity: 1, merged: false, targetLabel: 'Clayette 2' })).toBe(
      '1 bouteille déplacée vers Clayette 2.',
    );
    expect(bottleMoveMessage({ quantity: 3, merged: true, targetLabel: 'Clayette 2' })).toBe(
      '3 bouteilles regroupées avec celles de Clayette 2.',
    );
  });
});
