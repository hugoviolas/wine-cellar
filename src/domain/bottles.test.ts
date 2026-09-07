import { describe, it, expect } from 'vitest';
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
} from './bottles';

describe('bottles', () => {
  it('crée une bouteille avec des détails valides pour sa catégorie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Château Margaux',
      quantity: 1,
      details: { grapeVarieties: ['Cabernet Sauvignon'] },
    });

    const bottles = await listBottlesByCellar(db, cellarId);
    expect(bottles).toHaveLength(1);
    expect(bottles[0].bottle.name).toBe('Château Margaux');
  });

  it('rejette des détails invalides pour la catégorie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    await expect(
      createBottle(db, {
        crateId,
        category: 'cider',
        name: 'Cidre du Perche',
        quantity: 1,
        details: { method: 'industriel' },
      }),
    ).rejects.toThrow();
  });

  it('isole les bouteilles par cave', async () => {
    const db = await createTestDb();
    const cave1 = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave 1' });
    const cave2 = await bootstrapSuperAdmin(db, { email: 'b@example.com', password: 'x', cellarName: 'Cave 2' });
    const crate1 = await createCrate(db, { cellarId: cave1.cellarId, name: 'C1', capacity: 6 });
    const crate2 = await createCrate(db, { cellarId: cave2.cellarId, name: 'C2', capacity: 6 });

    await createBottle(db, { crateId: crate1, category: 'wine', name: 'Vin A', quantity: 1, details: {} });
    await createBottle(db, { crateId: crate2, category: 'wine', name: 'Vin B', quantity: 1, details: {} });

    const bottlesCave1 = await listBottlesByCellar(db, cave1.cellarId);
    expect(bottlesCave1).toHaveLength(1);
    expect(bottlesCave1[0].bottle.name).toBe('Vin A');
  });

  it('exclut les bouteilles épuisées de la liste active', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    await createBottle(db, { crateId, category: 'wine', name: 'Épuisée', quantity: 0, details: {} });
    await createBottle(db, { crateId, category: 'wine', name: 'Disponible', quantity: 2, details: {} });

    const active = await listActiveBottlesByCellar(db, cellarId);
    expect(active).toHaveLength(1);
    expect(active[0].bottle.name).toBe('Disponible');

    const all = await listBottlesByCellar(db, cellarId);
    expect(all).toHaveLength(2);
  });
});

describe('getBottle / updateBottle / deleteBottle', () => {
  it('retourne null pour un identifiant inconnu', async () => {
    const db = await createTestDb();
    expect(await getBottle(db, 'inconnu')).toBeNull();
  });

  it('met à jour la note personnelle et la quantité', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });

    await updateBottle(db, bottleId, { userNote: 'Superbe avec un gigot', quantity: 1 });
    const bottle = await getBottle(db, bottleId);
    expect(bottle?.userNote).toBe('Superbe avec un gigot');
    expect(bottle?.quantity).toBe(1);
  });

  it('met à jour la note sur 5 d’une bouteille pas encore consommée', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });

    await updateBottle(db, bottleId, { rating: 4 });
    const bottle = await getBottle(db, bottleId);
    expect(bottle?.rating).toBe(4);
  });

  it('met à jour les champs d’identité de la bouteille (édition complète)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await updateBottle(db, bottleId, {
      name: 'Château Margaux',
      producer: 'Château Margaux',
      vintage: 2015,
      region: 'Bordeaux',
      color: 'rouge',
      abv: 13.5,
      volumeMl: 750,
    });
    const bottle = await getBottle(db, bottleId);
    expect(bottle?.name).toBe('Château Margaux');
    expect(bottle?.producer).toBe('Château Margaux');
    expect(bottle?.vintage).toBe(2015);
    expect(bottle?.region).toBe('Bordeaux');
    expect(bottle?.color).toBe('rouge');
    expect(bottle?.abv).toBe(13.5);
    expect(bottle?.volumeMl).toBe(750);
  });

  it('supprime une bouteille', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await deleteBottle(db, bottleId);
    expect(await getBottle(db, bottleId)).toBeNull();
  });

  it('ajoute chaque nouvelle bouteille à la fin de sa clayette (sortOrder croissant)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const firstId = await createBottle(db, { crateId, category: 'wine', name: 'Premier', quantity: 1, details: {} });
    const secondId = await createBottle(db, { crateId, category: 'wine', name: 'Second', quantity: 1, details: {} });

    const first = await getBottle(db, firstId);
    const second = await getBottle(db, secondId);
    expect(first?.sortOrder).toBe(0);
    expect(second?.sortOrder).toBe(1);
  });

  it('place une bouteille déplacée vers une autre clayette à la fin de celle-ci', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateAId = await createCrate(db, { cellarId, name: 'Clayette A', capacity: 12 });
    const crateBId = await createCrate(db, { cellarId, name: 'Clayette B', capacity: 12 });
    await createBottle(db, { crateId: crateBId, category: 'wine', name: 'Déjà là', quantity: 1, details: {} });
    const movedId = await createBottle(db, { crateId: crateAId, category: 'wine', name: 'À déplacer', quantity: 1, details: {} });

    await updateBottle(db, movedId, { crateId: crateBId });

    const moved = await getBottle(db, movedId);
    expect(moved?.crateId).toBe(crateBId);
    expect(moved?.sortOrder).toBe(1);
  });
});

describe('reorderBottlesInCrate', () => {
  it('applique le nouvel ordre aux bouteilles actives de la clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const aId = await createBottle(db, { crateId, category: 'wine', name: 'A', quantity: 1, details: {} });
    const bId = await createBottle(db, { crateId, category: 'wine', name: 'B', quantity: 1, details: {} });
    const cId = await createBottle(db, { crateId, category: 'wine', name: 'C', quantity: 1, details: {} });

    await reorderBottlesInCrate(db, crateId, [cId, aId, bId]);

    const ordered = await listActiveBottlesByCellar(db, cellarId);
    expect(ordered.map((row) => row.bottle.id)).toEqual([cId, aId, bId]);
  });

  it('rejette une liste qui ne correspond pas exactement aux bouteilles actives de la clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    await createBottle(db, { crateId, category: 'wine', name: 'A', quantity: 1, details: {} });

    await expect(reorderBottlesInCrate(db, crateId, ['id-inconnu'])).rejects.toThrow();
  });

  it('ignore les bouteilles épuisées (quantité 0) dans la validation de l’ensemble', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const activeId = await createBottle(db, { crateId, category: 'wine', name: 'Active', quantity: 1, details: {} });
    const emptyId = await createBottle(db, { crateId, category: 'wine', name: 'Épuisée', quantity: 0, details: {} });

    await reorderBottlesInCrate(db, crateId, [activeId]);
    const empty = await getBottle(db, emptyId);
    expect(empty?.sortOrder).toBe(1);
  });
});

describe('updateBottleBodySchema', () => {
  it('rejette une clé réellement inconnue', () => {
    const result = updateBottleBodySchema.safeParse({ notAField: 'x', userNote: 'y' });
    expect(result.success).toBe(false);
  });

  it('accepte crateId (réaffectation de clayette) — la vérification "même cave" se fait dans la route', () => {
    const result = updateBottleBodySchema.safeParse({ crateId: 'une-autre-clayette' });
    expect(result.success).toBe(true);
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

  it('rejette une note hors de la plage 0-5', () => {
    expect(updateBottleBodySchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(updateBottleBodySchema.safeParse({ rating: -1 }).success).toBe(false);
  });
});
