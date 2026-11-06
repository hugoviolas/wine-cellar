import { describe, it, expect } from 'vitest';
import { isSameWine, groupSameWines } from './bottleIdentity';
import type { BottleIdentityFields } from './interfaces/bottle-identity-fields.interface';

const margaux: BottleIdentityFields = {
  category: 'wine',
  name: 'Château Margaux',
  producer: 'Château Margaux',
  vintage: 2015,
  color: 'red',
  volumeMl: 750,
};

describe('isSameWine', () => {
  it('ignore la casse, les accents, la ponctuation et les espaces superflus', () => {
    expect(
      isSameWine(margaux, { ...margaux, name: '  chateau   MARGAUX ', producer: 'Chateau-Margaux' }),
    ).toBe(true);
  });

  it('considère un volume non renseigné comme une 75 cl', () => {
    expect(isSameWine(margaux, { ...margaux, volumeMl: null })).toBe(true);
    expect(isSameWine({ ...margaux, volumeMl: 1500 }, { ...margaux, volumeMl: null })).toBe(false);
  });

  it('distingue le millésime, la couleur, la catégorie et le format', () => {
    expect(isSameWine(margaux, { ...margaux, vintage: 2016 })).toBe(false);
    expect(isSameWine(margaux, { ...margaux, vintage: null })).toBe(false);
    expect(isSameWine(margaux, { ...margaux, color: 'white' })).toBe(false);
    expect(isSameWine(margaux, { ...margaux, category: 'sparkling' })).toBe(false);
    expect(isSameWine(margaux, { ...margaux, volumeMl: 1500 })).toBe(false);
  });

  it('ne rapproche pas un producteur renseigné d’un producteur absent', () => {
    expect(isSameWine(margaux, { ...margaux, producer: null })).toBe(false);
    expect(isSameWine({ ...margaux, producer: null }, { ...margaux, producer: '' })).toBe(true);
  });
});

describe('groupSameWines', () => {
  it('regroupe les vins identiques en gardant l’ordre de première apparition', () => {
    const a = { ...margaux, id: 'a' };
    const b = { ...margaux, id: 'b', name: 'Pavillon Rouge' };
    const c = { ...margaux, id: 'c', name: 'chateau margaux' };

    const groups = groupSameWines([a, b, c]);

    expect(groups.map((group) => group.map((item) => item.id))).toEqual([['a', 'c'], ['b']]);
  });
});
