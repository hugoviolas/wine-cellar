import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle } from './bottles';
import { resolveBottleAccess } from './bottleAccess';
import { users, cellarMemberships } from '../db/schema';
import { newId } from '../db/id';
import { hashPassword } from './auth';

describe('resolveBottleAccess', () => {
  it('autorise le propriétaire de la cave de la bouteille', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Château Margaux',
      quantity: 1,
      details: {},
    });

    const result = await resolveBottleAccess(db, userId, bottleId);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('accès inattendu');
    expect(result.bottle.id).toBe(bottleId);
    expect(result.bottle.name).toBe('Château Margaux');
  });

  it('refuse un utilisateur sans membership dans la cave de la bouteille', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Vin privé',
      quantity: 1,
      details: {},
    });

    const otherCave = await bootstrapSuperAdmin(db, {
      email: 'autre-admin@example.com',
      password: 'x',
      cellarName: 'Autre Cave',
    });
    const intrusId = newId();
    await db.insert(users).values({
      id: intrusId,
      email: 'intrus@example.com',
      passwordHash: await hashPassword('x'),
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    });
    await db.insert(cellarMemberships).values({
      id: newId(),
      cellarId: otherCave.cellarId,
      userId: intrusId,
      role: 'editor',
      createdAt: new Date().toISOString(),
    });

    const result = await resolveBottleAccess(db, intrusId, bottleId);
    expect(result).toEqual({ status: 'forbidden' });
  });

  it('retourne not_found pour un identifiant de bouteille inconnu', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });

    const result = await resolveBottleAccess(db, userId, 'bouteille-inconnue');
    expect(result).toEqual({ status: 'not_found' });
  });

  it('inclut le rôle du membre dans le résultat "ok"', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });
    const owner = (await db.select().from(users))[0];

    const result = await resolveBottleAccess(db, owner.id, bottleId);
    expect(result).toMatchObject({ status: 'ok', role: 'super_admin' });
  });
});
