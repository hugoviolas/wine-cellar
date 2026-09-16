import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import {
  createCrate,
  listCrates,
  renameCrate,
  updateCrateCapacity,
  deleteCrate,
  getCrateById,
  crateHasActiveBottles,
  reorderCrates,
} from './crates';
import { createBottle, getBottle } from './bottles';
import { consumeBottle } from './consume';
import { rowAt } from '../db/testRows';

describe('crates', () => {
  it('crée puis liste une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });

    await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const crates = await listCrates({ db, cellarId });
    expect(crates).toHaveLength(1);
    expect(rowAt(crates, 0).name).toBe('Clayette 1');
    expect(rowAt(crates, 0).capacity).toBe(12);
  });

  it('renomme une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Ancien nom', capacity: 6 } });
    await renameCrate({ db, crateId, name: 'Nouveau nom' });
    const crates = await listCrates({ db, cellarId });
    expect(rowAt(crates, 0).name).toBe('Nouveau nom');
  });

  it('stocke un nom nul si aucun nom n’est fourni à la création (le nom par défaut est calculé à l’affichage)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, capacity: 6 } });
    const crate = await getCrateById({ db, crateId });
    expect(crate?.name).toBeNull();
  });

  it('stocke un nom nul si un nom vide (espaces) est fourni à la création', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: '   ', capacity: 6 } });
    const crate = await getCrateById({ db, crateId });
    expect(crate?.name).toBeNull();
  });

  it('efface le nom (nul) si on renomme avec un nom vide', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Un nom', capacity: 6 } });
    await renameCrate({ db, crateId, name: '   ' });
    const crate = await getCrateById({ db, crateId });
    expect(crate?.name).toBeNull();
  });

  it('change la capacité d’une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette', capacity: 6 } });
    await updateCrateCapacity({ db, crateId, capacity: 24 });
    const crate = await getCrateById({ db, crateId });
    expect(crate?.capacity).toBe(24);
  });

  it('supprime une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'À supprimer', capacity: 6 } });
    await deleteCrate({ db, crateId });
    expect(await listCrates({ db, cellarId })).toHaveLength(0);
  });

  it('retourne null pour un identifiant de clayette inconnu', async () => {
    const db = await createTestDb();
    expect(await getCrateById({ db, crateId: 'inconnu' })).toBeNull();
  });

  it('retourne la clayette correspondant à son identifiant', async () => {
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
    const crate = await getCrateById({ db, crateId });
    expect(crate?.name).toBe('Clayette 1');
    expect(crate?.cellarId).toBe(cellarId);
  });

  it('attribue des numéros auto-incrémentés à la création', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const id1 = await createCrate({ db, input: { cellarId, name: 'Bordeaux', capacity: 6 } });
    const id2 = await createCrate({ db, input: { cellarId, name: 'Champagne', capacity: 6 } });
    const crate1 = await getCrateById({ db, crateId: id1 });
    const crate2 = await getCrateById({ db, crateId: id2 });
    expect(crate1?.number).toBe(1);
    expect(crate2?.number).toBe(2);
  });

  it('réutilise le numéro d’une clayette supprimée plutôt que de décaler les autres', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const id1 = await createCrate({ db, input: { cellarId, name: 'Bordeaux', capacity: 6 } });
    const id2 = await createCrate({ db, input: { cellarId, name: 'Champagne', capacity: 6 } });
    const id3 = await createCrate({ db, input: { cellarId, name: 'Cidres', capacity: 6 } });
    await deleteCrate({ db, crateId: id2 });

    const id4 = await createCrate({ db, input: { cellarId, name: 'Spiritueux', capacity: 6 } });
    const crate4 = await getCrateById({ db, crateId: id4 });
    expect(crate4?.number).toBe(2);

    const crate3 = await getCrateById({ db, crateId: id3 });
    expect(crate3?.number).toBe(3);
    expect(id1).not.toBe(id2);
  });

  it('crateHasActiveBottles distingue bouteilles en stock et bouteilles épuisées', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Bordeaux', capacity: 6 } });
    expect(await crateHasActiveBottles({ db, crateId })).toBe(false);

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
    expect(await crateHasActiveBottles({ db, crateId })).toBe(true);

    await consumeBottle({ db, input: { bottleId, consumedByUserId: userId, consumedAt: '2026-09-07' } });
    expect(await crateHasActiveBottles({ db, crateId })).toBe(false);
  });

  it('supprime une clayette ne contenant que des bouteilles épuisées, qui deviennent orphelines', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Bordeaux', capacity: 6 } });
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
    await consumeBottle({ db, input: { bottleId, consumedByUserId: userId, consumedAt: '2026-09-07' } });

    expect(await crateHasActiveBottles({ db, crateId })).toBe(false);
    await deleteCrate({ db, crateId });

    expect(await getCrateById({ db, crateId })).toBeNull();
    const bottle = await getBottle({ db, bottleId });
    expect(bottle?.crateId).toBeNull();
  });

  it('applique le nouvel ordre demandé (glisser-déposer)', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const id1 = await createCrate({ db, input: { cellarId, name: 'Bordeaux', capacity: 6 } });
    const id2 = await createCrate({ db, input: { cellarId, name: 'Champagne', capacity: 6 } });
    const id3 = await createCrate({ db, input: { cellarId, name: 'Cidres', capacity: 6 } });

    await reorderCrates({ db, cellarId, orderedIds: [id3, id1, id2] });

    const ordered = await listCrates({ db, cellarId });
    expect(ordered.map((c) => c.id)).toEqual([id3, id1, id2]);
    // Les numéros stables ne bougent pas avec le réordonnancement.
    expect(ordered.map((c) => c.number)).toEqual([3, 1, 2]);
  });

  it('refuse un réordonnancement qui ne correspond pas exactement aux clayettes de la cave', async () => {
    const db = await createTestDb();
    const caveA = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave A',
      },
    });
    const caveB = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'b@example.com',
        password: 'x',
        cellarName: 'Cave B',
      },
    });
    const id1 = await createCrate({ db, input: { cellarId: caveA.cellarId, name: 'Bordeaux', capacity: 6 } });
    const otherId = await createCrate({
      db,
      input: { cellarId: caveB.cellarId, name: 'Autre cave', capacity: 6 },
    });

    await expect(
      reorderCrates({ db, cellarId: caveA.cellarId, orderedIds: [id1, otherId] }),
    ).rejects.toThrow();
    await expect(reorderCrates({ db, cellarId: caveA.cellarId, orderedIds: [] })).rejects.toThrow();
  });
});
