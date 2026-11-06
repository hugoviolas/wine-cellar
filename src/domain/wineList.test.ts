import { describe, it, expect } from 'vitest';
import { buildWineList } from './wineList';
import type { BottleRow, CrateRow } from '../db/rows';

const crate = (id: string, number: number, sortOrder: number): CrateRow => ({
  id,
  cellarId: 'cave',
  number,
  name: null,
  capacity: 12,
  sortOrder,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const bottle = (overrides: Partial<BottleRow>): BottleRow => ({
  id: 'b',
  crateId: null,
  sortOrder: 0,
  category: 'wine',
  name: 'Château Margaux',
  producer: 'Château Margaux',
  vintage: 2015,
  region: null,
  subRegion: null,
  color: 'red',
  abv: null,
  volumeMl: 750,
  quantity: 1,
  drinkFrom: null,
  drinkUntil: null,
  details: {},
  aiAnalysis: null,
  aiPairings: null,
  aiTastingAdvice: null,
  aiPriceEstimate: null,
  aiGeneratedAt: null,
  userNote: null,
  rating: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

describe('buildWineList', () => {
  it('fusionne les lots d’un même vin répartis sur plusieurs clayettes', () => {
    const haut = crate('haut', 1, 0);
    const bas = crate('bas', 2, 1);
    const rows = [
      { bottle: bottle({ id: 'm-bas', quantity: 4, rating: 5, createdAt: '2026-06-01' }), crate: bas },
      { bottle: bottle({ id: 'autre', name: 'Pavillon Rouge' }), crate: haut },
      {
        bottle: bottle({ id: 'm-haut', quantity: 2, name: 'chateau margaux', createdAt: '2026-02-01' }),
        crate: haut,
      },
    ];

    const list = buildWineList({ rows, currentYear: 2026 });

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: 'm-bas',
      name: 'Château Margaux',
      quantity: 6,
      rating: 5,
      createdAt: '2026-02-01',
      lots: [
        { id: 'm-haut', crateLabel: 'Clayette 1', quantity: 2 },
        { id: 'm-bas', crateLabel: 'Clayette 2', quantity: 4 },
      ],
    });
    expect(list[1]).toMatchObject({
      id: 'autre',
      quantity: 1,
      lots: [{ id: 'autre', crateLabel: 'Clayette 1' }],
    });
  });

  it('garde séparés deux millésimes du même vin', () => {
    const haut = crate('haut', 1, 0);
    const rows = [
      { bottle: bottle({ id: 'a', vintage: 2015 }), crate: haut },
      { bottle: bottle({ id: 'b', vintage: 2016 }), crate: haut },
    ];

    expect(buildWineList({ rows, currentYear: 2026 }).map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});
