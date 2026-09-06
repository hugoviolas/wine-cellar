import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate, listCrates, renameCrate, deleteCrate, getCrateById } from './crates';

describe('crates', () => {
  it('crée puis liste une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });

    await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const crates = await listCrates(db, cellarId);
    expect(crates).toHaveLength(1);
    expect(crates[0].name).toBe('Clayette 1');
    expect(crates[0].capacity).toBe(12);
  });

  it('renomme une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Ancien nom', capacity: 6 });
    await renameCrate(db, crateId, 'Nouveau nom');
    const crates = await listCrates(db, cellarId);
    expect(crates[0].name).toBe('Nouveau nom');
  });

  it('supprime une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'À supprimer', capacity: 6 });
    await deleteCrate(db, crateId);
    expect(await listCrates(db, cellarId)).toHaveLength(0);
  });

  it('retourne null pour un identifiant de clayette inconnu', async () => {
    const db = await createTestDb();
    expect(await getCrateById(db, 'inconnu')).toBeNull();
  });

  it('retourne la clayette correspondant à son identifiant', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const crate = await getCrateById(db, crateId);
    expect(crate?.name).toBe('Clayette 1');
    expect(crate?.cellarId).toBe(cellarId);
  });
});
