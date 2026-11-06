import { describe, it, expect } from 'vitest';
import type { BottleRow, CrateRow } from '../db/rows';
import { filterBottles, normalizeForSearch } from './bottleSearch';
import type { BottleWithCrate } from './interfaces/bottle-with-crate.interface';
import type { BottleFilters } from './interfaces/bottle-filters.interface';

const crate: CrateRow = {
  id: 'clayette-1',
  cellarId: 'cave',
  number: 1,
  name: 'Bordeaux',
  capacity: 12,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const row = (overrides: Partial<BottleRow>): BottleWithCrate => {
  return {
    crate,
    bottle: {
      id: overrides.name ?? 'bouteille',
      crateId: crate.id,
      sortOrder: 0,
      category: 'wine',
      name: 'Bouteille',
      producer: null,
      vintage: null,
      region: null,
      subRegion: null,
      color: null,
      abv: null,
      volumeMl: null,
      quantity: 1,
      drinkFrom: null,
      drinkUntil: null,
      details: { grapeVarieties: [] },
      aiAnalysis: null,
      aiPairings: null,
      aiTastingAdvice: null,
      aiPriceEstimate: null,
      aiGeneratedAt: null,
      userNote: null,
      rating: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
  };
};

const rows = [
  row({
    name: 'Côte-Rôtie La Landonne',
    producer: 'Guigal',
    vintage: 2015,
    region: 'Vallée du Rhône',
    subRegion: 'Rhône septentrional',
    color: 'rouge',
    details: { grapeVarieties: ['Syrah'], appellation: 'Côte-Rôtie' },
    drinkFrom: 2025,
    drinkUntil: 2045,
  }),
  row({
    name: 'Chablis Premier Cru',
    vintage: 2021,
    region: 'Bourgogne',
    color: 'blanc',
    details: { grapeVarieties: ['Chardonnay'] },
    drinkFrom: 2023,
    drinkUntil: 2027,
  }),
  row({ name: 'Bière de garde', category: 'beer', details: {} }),
  row({ name: 'Chablis bu', region: 'Bourgogne', color: 'blanc', quantity: 0 }),
];

const names = (filters: BottleFilters): string[] => {
  return filterBottles({ rows, filters, currentYear: 2026 }).map(({ bottle }) => bottle.name);
};

describe('normalizeForSearch', () => {
  it('ignore la casse et les accents', () => {
    expect(normalizeForSearch('CÔTE-Rôtie Rosé')).toBe('cote-rotie rose');
  });
});

describe('filterBottles', () => {
  it('écarte par défaut les bouteilles épuisées', () => {
    expect(names({})).toEqual(['Côte-Rôtie La Landonne', 'Chablis Premier Cru', 'Bière de garde']);
  });

  it('les garde à la demande', () => {
    expect(names({ includeFinished: true })).toHaveLength(4);
  });

  it('cherche tous les mots, sans accents, dans tous les champs', () => {
    expect(names({ query: 'cote rotie syrah' })).toEqual(['Côte-Rôtie La Landonne']);
    expect(names({ query: 'guigal 2015' })).toEqual(['Côte-Rôtie La Landonne']);
    expect(names({ query: 'chardonnay' })).toEqual(['Chablis Premier Cru']);
    expect(names({ query: 'guigal chardonnay' })).toEqual([]);
  });

  it('trouve une bouteille par le nom de sa clayette', () => {
    expect(names({ query: 'bordeaux' })).toHaveLength(3);
  });

  it('filtre sur la région ou la sous-région', () => {
    expect(names({ region: 'rhone septentrional' })).toEqual(['Côte-Rôtie La Landonne']);
    expect(names({ region: 'Bourgogne' })).toEqual(['Chablis Premier Cru']);
  });

  it('filtre sur la catégorie, la couleur et le millésime', () => {
    expect(names({ category: 'beer' })).toEqual(['Bière de garde']);
    expect(names({ color: 'blanc' })).toEqual(['Chablis Premier Cru']);
    expect(names({ vintageFrom: 2016 })).toEqual(['Chablis Premier Cru']);
    expect(names({ vintageTo: 2016 })).toEqual(['Côte-Rôtie La Landonne']);
  });

  it('filtre sur le statut de garde', () => {
    expect(names({ gardeStatus: 'ready' })).toEqual(['Côte-Rôtie La Landonne']);
    expect(names({ gardeStatus: 'closing_window' })).toEqual(['Chablis Premier Cru']);
    expect(names({ gardeStatus: 'unknown' })).toEqual(['Bière de garde']);
  });
});
