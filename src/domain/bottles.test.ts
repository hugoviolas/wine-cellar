import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import {
  createBottle,
  listBottlesByCellar,
  listActiveBottlesByCellar,
  getBottle,
  updateBottle,
  deleteBottle,
  updateBottleBodySchema,
  reorderBottlesInCrate,
  moveBottles,
  moveBottlesBodySchema,
  BottleMoveError,
  findSameWineLots,
} from './bottles';
import { consumeBottle } from './consume';
import { listBottleConsumptions } from './history';
import { rowAt } from '../db/testRows';
import type { Db } from '../db/client';
import { wishlistItems } from '../db/schema';

describe('bottles', () => {
  it('crée une bouteille avec des détails valides pour sa catégorie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });

    await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Château Margaux',
        quantity: 1,
        details: { grapeVarieties: ['Cabernet Sauvignon'] },
      },
    });

    const bottles = await listBottlesByCellar({ db, cellarId });
    expect(bottles).toHaveLength(1);
    expect(rowAt(bottles, 0).bottle.name).toBe('Château Margaux');
  });

  it('rejette des détails invalides pour la catégorie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });

    await expect(
      createBottle({
        db,
        input: {
          crateId,
          category: 'wine',
          name: 'Château Bancal',
          quantity: 1,
          // `grapeVarieties` attend un tableau : une chaîne doit être refusée
          // plutôt que stockée telle quelle dans la colonne JSON.
          details: { grapeVarieties: 'Merlot' },
        },
      }),
    ).rejects.toThrow();
  });

  it('isole les bouteilles par cave', async () => {
    const db = await createTestDb();
    const cave1 = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave 1',
      },
    });
    const cave2 = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'b@example.com',
        password: 'x',
        cellarName: 'Cave 2',
      },
    });
    const crate1 = await createCrate({ db, input: { cellarId: cave1.cellarId, name: 'C1', capacity: 6 } });
    const crate2 = await createCrate({ db, input: { cellarId: cave2.cellarId, name: 'C2', capacity: 6 } });

    await createBottle({
      db,
      input: { crateId: crate1, category: 'wine', name: 'Vin A', quantity: 1, details: {} },
    });
    await createBottle({
      db,
      input: { crateId: crate2, category: 'wine', name: 'Vin B', quantity: 1, details: {} },
    });

    const bottlesCave1 = await listBottlesByCellar({ db, cellarId: cave1.cellarId });
    expect(bottlesCave1).toHaveLength(1);
    expect(rowAt(bottlesCave1, 0).bottle.name).toBe('Vin A');
  });

  it('exclut les bouteilles épuisées de la liste active', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });

    await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Épuisée', quantity: 0, details: {} },
    });
    await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Disponible', quantity: 2, details: {} },
    });

    const active = await listActiveBottlesByCellar({ db, cellarId });
    expect(active).toHaveLength(1);
    expect(rowAt(active, 0).bottle.name).toBe('Disponible');

    const all = await listBottlesByCellar({ db, cellarId });
    expect(all).toHaveLength(2);
  });
});

describe('getBottle / updateBottle / deleteBottle', () => {
  it('retourne null pour un identifiant inconnu', async () => {
    const db = await createTestDb();
    expect(await getBottle({ db, bottleId: 'inconnu' })).toBeNull();
  });

  it('met à jour la note personnelle et la quantité', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Vin',
        quantity: 2,
        details: {},
      },
    });

    await updateBottle({ db, bottleId, input: { userNote: 'Superbe avec un gigot', quantity: 1 } });
    const bottle = await getBottle({ db, bottleId });
    expect(bottle?.userNote).toBe('Superbe avec un gigot');
    expect(bottle?.quantity).toBe(1);
  });

  it('met à jour la note sur 5 d’une bouteille pas encore consommée', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Vin',
        quantity: 2,
        details: {},
      },
    });

    await updateBottle({ db, bottleId, input: { rating: 4 } });
    const bottle = await getBottle({ db, bottleId });
    expect(bottle?.rating).toBe(4);
  });

  it('met à jour les champs d’identité de la bouteille (édition complète)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Vin',
        quantity: 1,
        details: {},
      },
    });

    await updateBottle({
      db,
      bottleId,
      input: {
        name: 'Château Margaux',
        producer: 'Château Margaux',
        vintage: 2015,
        region: 'Bordeaux',
        color: 'rouge',
        abv: 13.5,
        volumeMl: 750,
      },
    });
    const bottle = await getBottle({ db, bottleId });
    expect(bottle?.name).toBe('Château Margaux');
    expect(bottle?.producer).toBe('Château Margaux');
    expect(bottle?.vintage).toBe(2015);
    expect(bottle?.region).toBe('Bordeaux');
    expect(bottle?.color).toBe('rouge');
    expect(bottle?.abv).toBe(13.5);
    expect(bottle?.volumeMl).toBe(750);
  });

  it('met à jour les détails de catégorie (cépages, appellation)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Vin',
        quantity: 1,
        details: {},
      },
    });

    await updateBottle({
      db,
      bottleId,
      input: {
        details: { grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' },
      },
    });
    const bottle = await getBottle({ db, bottleId });
    expect(bottle?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });

  it('supprime une bouteille', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Vin',
        quantity: 1,
        details: {},
      },
    });

    await deleteBottle({ db, bottleId });
    expect(await getBottle({ db, bottleId })).toBeNull();
  });

  it('ajoute chaque nouvelle bouteille à la fin de sa clayette (sortOrder croissant)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const firstId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Premier',
        quantity: 1,
        details: {},
      },
    });
    const secondId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Second',
        quantity: 1,
        details: {},
      },
    });

    const first = await getBottle({ db, bottleId: firstId });
    const second = await getBottle({ db, bottleId: secondId });
    expect(first?.sortOrder).toBe(0);
    expect(second?.sortOrder).toBe(1);
  });
});

describe('reorderBottlesInCrate', () => {
  it('applique le nouvel ordre aux bouteilles actives de la clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const aId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'A', quantity: 1, details: {} },
    });
    const bId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'B', quantity: 1, details: {} },
    });
    const cId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'C', quantity: 1, details: {} },
    });

    await reorderBottlesInCrate({ db, crateId, orderedIds: [cId, aId, bId] });

    const ordered = await listActiveBottlesByCellar({ db, cellarId });
    expect(ordered.map((row) => row.bottle.id)).toEqual([cId, aId, bId]);
  });

  it('rejette une liste qui ne correspond pas exactement aux bouteilles actives de la clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    await createBottle({ db, input: { crateId, category: 'wine', name: 'A', quantity: 1, details: {} } });

    await expect(reorderBottlesInCrate({ db, crateId, orderedIds: ['id-inconnu'] })).rejects.toThrow();
  });

  it('ignore les bouteilles épuisées (quantité 0) dans la validation de l’ensemble', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const activeId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Active',
        quantity: 1,
        details: {},
      },
    });
    const emptyId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Épuisée',
        quantity: 0,
        details: {},
      },
    });

    await reorderBottlesInCrate({ db, crateId, orderedIds: [activeId] });
    const empty = await getBottle({ db, bottleId: emptyId });
    expect(empty?.sortOrder).toBe(1);
  });
});

describe('updateBottleBodySchema', () => {
  it('rejette une clé réellement inconnue', () => {
    const result = updateBottleBodySchema.safeParse({ notAField: 'x', userNote: 'y' });
    expect(result.success).toBe(false);
  });

  it('rejette crateId : changer de clayette passe par moveBottles', () => {
    expect(updateBottleBodySchema.safeParse({ crateId: 'c1' }).success).toBe(false);
  });

  it('rejette une quantité négative', () => {
    const result = updateBottleBodySchema.safeParse({ quantity: -1 });
    expect(result.success).toBe(false);
  });

  it('accepte une mise à jour valide', () => {
    const result = updateBottleBodySchema.safeParse({ userNote: 'Superbe', quantity: 0, drinkUntil: null });
    expect(result.success).toBe(true);
  });

  it('accepte les champs d’identité (édition complète) avec valeurs nulles pour les effacer', () => {
    const result = updateBottleBodySchema.safeParse({
      producer: null,
      vintage: 2018,
      region: null,
      color: 'blanc',
      abv: null,
      volumeMl: 750,
    });
    expect(result.success).toBe(true);
  });

  it('accepte une note entre 0 et 5, ou nulle pour l’effacer', () => {
    expect(updateBottleBodySchema.safeParse({ rating: 4 }).success).toBe(true);
    expect(updateBottleBodySchema.safeParse({ rating: null }).success).toBe(true);
  });

  it('accepte details comme JSON quelconque — la forme précise est validée dans la route selon la catégorie', () => {
    const result = updateBottleBodySchema.safeParse({
      details: { grapeVarieties: ['Niellucciu'], appellation: 'Patrimonio' },
    });
    expect(result.success).toBe(true);
  });

  it('rejette une note hors de la plage 0-5', () => {
    expect(updateBottleBodySchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(updateBottleBodySchema.safeParse({ rating: -1 }).success).toBe(false);
  });
});

describe('moveBottles', () => {
  const setup = async (): Promise<{
    db: Db;
    userId: string;
    cellarId: string;
    crateAId: string;
    crateBId: string;
    bottleId: string;
  }> => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'Cave' },
    });
    const crateAId = await createCrate({ db, input: { cellarId, name: 'Clayette A', capacity: 12 } });
    const crateBId = await createCrate({ db, input: { cellarId, name: 'Clayette B', capacity: 12 } });
    await createBottle({
      db,
      input: { crateId: crateBId, category: 'wine', name: 'Déjà là', quantity: 1, details: {} },
    });
    const bottleId = await createBottle({ db, input: margauxInput(crateAId, 6) });
    return { db, userId, cellarId, crateAId, crateBId, bottleId };
  };

  const margauxInput = (crateId: string, quantity: number): Parameters<typeof createBottle>[0]['input'] => ({
    crateId,
    category: 'wine',
    name: 'Château Margaux',
    producer: 'Château Margaux',
    vintage: 2015,
    color: 'red',
    quantity,
    drinkFrom: 2025,
    drinkUntil: 2050,
    details: { grapeVarieties: ['Cabernet Sauvignon'] },
    userNote: 'Pour les grandes occasions',
    aiAnalysis: 'Grand vin de garde.',
    aiGeneratedAt: '2026-01-01T00:00:00.000Z',
  });

  describe('sans lot du même vin dans la clayette cible', () => {
    it('scinde la ligne : le reste ne bouge pas, les bouteilles déplacées forment une copie en fin de clayette', async () => {
      const { db, crateAId, crateBId, bottleId } = await setup();
      const source = await getBottle({ db, bottleId });

      const result = await moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 2 });

      expect(result.merged).toBe(false);
      expect(result.bottleId).not.toBe(bottleId);
      const remaining = await getBottle({ db, bottleId });
      expect(remaining?.crateId).toBe(crateAId);
      expect(remaining?.quantity).toBe(4);
      expect(await getBottle({ db, bottleId: result.bottleId })).toEqual({
        ...source,
        id: result.bottleId,
        crateId: crateBId,
        sortOrder: 1,
        quantity: 2,
      });
    });

    it('laisse l’historique de consommation sur la ligne d’origine lors d’une scission', async () => {
      const { db, userId, crateBId, bottleId } = await setup();
      await consumeBottle({
        db,
        input: { bottleId, consumedByUserId: userId, consumedAt: '2026-11-01', quantity: 1 },
      });

      const result = await moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 2 });

      expect(await listBottleConsumptions({ db, bottleId })).toHaveLength(1);
      expect(await listBottleConsumptions({ db, bottleId: result.bottleId })).toHaveLength(0);
      expect((await getBottle({ db, bottleId }))?.quantity).toBe(3);
    });

    it('déplace la ligne entière sans quantité précisée, ou avec tout le stock', async () => {
      const { db, cellarId, crateAId, crateBId, bottleId } = await setup();

      expect(await moveBottles({ db, bottleId, toCrateId: crateBId })).toEqual({ bottleId, merged: false });
      const moved = await getBottle({ db, bottleId });
      expect(moved?.crateId).toBe(crateBId);
      expect(moved?.quantity).toBe(6);
      expect(moved?.sortOrder).toBe(1);

      expect(await moveBottles({ db, bottleId, toCrateId: crateAId, quantity: 6 })).toEqual({
        bottleId,
        merged: false,
      });
      expect((await getBottle({ db, bottleId }))?.crateId).toBe(crateAId);
      expect(await listBottlesByCellar({ db, cellarId })).toHaveLength(2);
    });

    it('ne fusionne pas avec un autre millésime ni avec un lot épuisé du même vin', async () => {
      const { db, crateBId, bottleId } = await setup();
      await createBottle({ db, input: { ...margauxInput(crateBId, 3), vintage: 2016 } });
      await createBottle({ db, input: margauxInput(crateBId, 0) });

      const result = await moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 2 });

      expect(result.merged).toBe(false);
      expect((await getBottle({ db, bottleId: result.bottleId }))?.quantity).toBe(2);
    });
  });

  describe('avec un lot du même vin dans la clayette cible', () => {
    it('ajoute une partie du stock au lot existant, sans créer de ligne', async () => {
      const { db, cellarId, crateBId, bottleId } = await setup();
      const targetId = await createBottle({
        db,
        input: { ...margauxInput(crateBId, 3), name: 'chateau margaux' },
      });

      const result = await moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 2 });

      expect(result).toEqual({ bottleId: targetId, merged: true });
      expect((await getBottle({ db, bottleId: targetId }))?.quantity).toBe(5);
      expect((await getBottle({ db, bottleId }))?.quantity).toBe(4);
      expect(await listBottlesByCellar({ db, cellarId })).toHaveLength(3);
    });

    it('absorbe le lot déplacé en entier : historique et lien de wishlist rattachés, notes mises bout à bout', async () => {
      const { db, userId, crateBId, bottleId } = await setup();
      await consumeBottle({
        db,
        input: { bottleId, consumedByUserId: userId, consumedAt: '2026-11-01', quantity: 1 },
      });
      await db.insert(wishlistItems).values({
        id: 'wish-1',
        userId,
        category: 'wine',
        name: 'Château Margaux',
        details: {},
        status: 'promoted',
        promotedBottleId: bottleId,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const targetId = await createBottle({
        db,
        input: { ...margauxInput(crateBId, 3), userNote: 'Cadeau de Paul' },
      });

      const result = await moveBottles({ db, bottleId, toCrateId: crateBId });

      expect(result).toEqual({ bottleId: targetId, merged: true });
      expect(await getBottle({ db, bottleId })).toBeNull();
      const target = await getBottle({ db, bottleId: targetId });
      expect(target?.quantity).toBe(8);
      expect(target?.userNote).toBe('Cadeau de Paul\n\nPour les grandes occasions');
      expect(await listBottleConsumptions({ db, bottleId: targetId })).toHaveLength(1);
      const [wish] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, 'wish-1'));
      expect(wish?.promotedBottleId).toBe(targetId);
    });

    it('recompose un seul lot quand on ramène des bouteilles scindées', async () => {
      const { db, cellarId, crateAId, crateBId, bottleId } = await setup();
      const split = await moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 2 });

      const back = await moveBottles({ db, bottleId: split.bottleId, toCrateId: crateAId });

      expect(back).toEqual({ bottleId, merged: true });
      expect(await getBottle({ db, bottleId: split.bottleId })).toBeNull();
      const lot = await getBottle({ db, bottleId });
      expect(lot?.quantity).toBe(6);
      expect(lot?.userNote).toBe('Pour les grandes occasions');
      expect(await listBottlesByCellar({ db, cellarId })).toHaveLength(2);
    });
  });

  it('refuse de déplacer plus que le stock, sans rien modifier', async () => {
    const { db, cellarId, crateAId, crateBId, bottleId } = await setup();

    await expect(moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 7 })).rejects.toMatchObject({
      reason: 'insufficient_stock',
    });

    const unchanged = await getBottle({ db, bottleId });
    expect(unchanged?.crateId).toBe(crateAId);
    expect(unchanged?.quantity).toBe(6);
    expect(await listBottlesByCellar({ db, cellarId })).toHaveLength(2);
  });

  it('refuse une quantité nulle ou non entière', async () => {
    const { db, crateBId, bottleId } = await setup();

    await expect(moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 0 })).rejects.toMatchObject({
      reason: 'invalid_quantity',
    });
    await expect(moveBottles({ db, bottleId, toCrateId: crateBId, quantity: 1.5 })).rejects.toMatchObject({
      reason: 'invalid_quantity',
    });
  });

  it('refuse une clayette d’une autre cave', async () => {
    const { db, bottleId } = await setup();
    const other = await bootstrapSuperAdmin({
      db,
      params: { email: 'b@example.com', password: 'x', cellarName: 'Autre cave' },
    });
    const foreignCrateId = await createCrate({
      db,
      input: { cellarId: other.cellarId, name: 'Ailleurs', capacity: 12 },
    });

    await expect(moveBottles({ db, bottleId, toCrateId: foreignCrateId, quantity: 2 })).rejects.toMatchObject(
      { reason: 'other_cellar' },
    );
    expect((await getBottle({ db, bottleId }))?.quantity).toBe(6);
  });

  it('refuse une clayette inconnue ou la clayette actuelle', async () => {
    const { db, crateAId, bottleId } = await setup();

    await expect(moveBottles({ db, bottleId, toCrateId: 'inconnue', quantity: 2 })).rejects.toMatchObject({
      reason: 'crate_not_found',
    });
    await expect(moveBottles({ db, bottleId, toCrateId: crateAId, quantity: 2 })).rejects.toBeInstanceOf(
      BottleMoveError,
    );
  });
});

describe('findSameWineLots', () => {
  it('liste les lots actifs du même vin dans les clayettes demandées, la bouteille exclue', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'Cave' },
    });
    const crateAId = await createCrate({ db, input: { cellarId, capacity: 12 } });
    const crateBId = await createCrate({ db, input: { cellarId, capacity: 12 } });
    const input = { category: 'wine' as const, name: 'Margaux', vintage: 2015, details: {} };
    const sourceId = await createBottle({ db, input: { ...input, crateId: crateAId, quantity: 2 } });
    const sameId = await createBottle({ db, input: { ...input, crateId: crateBId, quantity: 1 } });
    await createBottle({ db, input: { ...input, crateId: crateBId, quantity: 0 } });
    await createBottle({ db, input: { ...input, crateId: crateBId, quantity: 1, vintage: undefined } });
    await createBottle({ db, input: { ...input, crateId: crateBId, quantity: 1, name: 'Autre' } });
    const source = await getBottle({ db, bottleId: sourceId });
    if (!source) {
      throw new Error('bouteille absente');
    }

    const lots = await findSameWineLots({ db, bottle: source, crateIds: [crateAId, crateBId] });

    expect(lots.map((lot) => lot.id)).toEqual([sameId]);
    expect(await findSameWineLots({ db, bottle: source, crateIds: [] })).toEqual([]);
  });
});

describe('moveBottlesBodySchema', () => {
  it('accepte une clayette seule (tout le stock) ou avec une quantité', () => {
    expect(moveBottlesBodySchema.safeParse({ crateId: 'c1' }).success).toBe(true);
    expect(moveBottlesBodySchema.safeParse({ crateId: 'c1', quantity: 2 }).success).toBe(true);
  });

  it('rejette une quantité nulle, décimale, ou une clé inconnue', () => {
    expect(moveBottlesBodySchema.safeParse({ crateId: 'c1', quantity: 0 }).success).toBe(false);
    expect(moveBottlesBodySchema.safeParse({ crateId: 'c1', quantity: 1.5 }).success).toBe(false);
    expect(moveBottlesBodySchema.safeParse({ crateId: 'c1', name: 'x' }).success).toBe(false);
  });
});
