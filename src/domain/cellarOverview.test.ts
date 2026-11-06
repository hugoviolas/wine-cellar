import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate, listCrates } from './crates';
import { createBottle, listBottlesByCellar } from './bottles';
import { listMemberCellars, summarizeCellar } from './cellarOverview';

describe('listMemberCellars', () => {
  it("liste les caves de l'utilisateur avec son rôle", async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'Ma Cave' },
    });

    const result = await listMemberCellars({ db, userId });

    expect(result.map(({ cellar, role }) => ({ id: cellar.id, name: cellar.name, role }))).toEqual([
      { id: cellarId, name: 'Ma Cave', role: 'owner' },
    ]);
  });
});

describe('summarizeCellar', () => {
  it('compte les bouteilles en stock par catégorie, couleur, garde, région et clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'Cave' },
    });
    const crateA = await createCrate({ db, input: { cellarId, capacity: 12 } });
    const crateB = await createCrate({ db, input: { cellarId, name: 'Bulles', capacity: 6 } });
    const wine = { category: 'wine' as const, details: { grapeVarieties: [] } };
    await createBottle({
      db,
      input: {
        ...wine,
        crateId: crateA,
        name: 'A',
        quantity: 3,
        color: 'rouge',
        region: 'Bordeaux',
        vintage: 2010,
      },
    });
    await createBottle({
      db,
      input: {
        ...wine,
        crateId: crateA,
        name: 'B',
        quantity: 2,
        color: 'blanc',
        vintage: 2020,
        drinkFrom: 2022,
        drinkUntil: 2040,
      },
    });
    await createBottle({
      db,
      input: {
        crateId: crateB,
        category: 'sparkling',
        name: 'C',
        quantity: 1,
        details: { grapeVarieties: [] },
      },
    });
    await createBottle({
      db,
      input: { ...wine, crateId: crateA, name: 'Bue', quantity: 0, region: 'Alsace' },
    });

    const summary = summarizeCellar({
      rows: await listBottlesByCellar({ db, cellarId }),
      crates: await listCrates({ db, cellarId }),
      currentYear: 2026,
    });

    expect(summary).toMatchObject({
      bottles: 6,
      references: 3,
      finishedReferences: 1,
      capacity: 18,
      byCategory: { wine: 5, sparkling: 1 },
      byColor: { rouge: 3, blanc: 2 },
      byGardeStatus: { unknown: 4, ready: 2 },
      // Ex aequo départagés par ordre alphabétique.
      topRegions: [
        { region: 'Bordeaux', bottles: 3 },
        { region: 'Inconnue', bottles: 3 },
      ],
      otherRegionsBottles: 0,
      oldestVintage: 2010,
      newestVintage: 2020,
    });
    expect(
      summary.crates.map(({ crate, bottles, references }) => ({ id: crate.id, bottles, references })),
    ).toEqual([
      { id: crateA, bottles: 5, references: 2 },
      { id: crateB, bottles: 1, references: 1 },
    ]);
  });
});
