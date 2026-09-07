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

  it('supprime une bouteille', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await deleteBottle(db, bottleId);
    expect(await getBottle(db, bottleId)).toBeNull();
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
});
