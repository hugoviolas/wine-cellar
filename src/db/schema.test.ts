import { describe, it, expect } from 'vitest';
import { createTestDb } from './testDb';
import { users, cellars, cellarMemberships, crates, bottles, consumptionHistory } from './schema';
import { newId } from './id';

describe('schema', () => {
  it('permet d’insérer et de relire la chaîne complète user -> cellar -> crate -> bottle -> historique', async () => {
    const db = await createTestDb();
    const userId = newId();
    await db.insert(users).values({
      id: userId,
      email: 'test@example.com',
      passwordHash: 'hash',
      isSuperAdmin: true,
      createdAt: new Date().toISOString(),
    });

    const cellarId = newId();
    await db.insert(cellars).values({
      id: cellarId,
      name: 'Ma Cave',
      ownerId: userId,
      aiEnabled: true,
      createdAt: new Date().toISOString(),
    });

    await db.insert(cellarMemberships).values({
      id: newId(),
      cellarId,
      userId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    });

    const crateId = newId();
    await db.insert(crates).values({
      id: crateId,
      cellarId,
      name: 'Clayette 1',
      capacity: 12,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    });

    const bottleId = newId();
    await db.insert(bottles).values({
      id: bottleId,
      crateId,
      category: 'wine',
      name: 'Château Margaux',
      quantity: 1,
      details: { grapeVarieties: ['Cabernet Sauvignon'] },
      createdAt: new Date().toISOString(),
    });

    await db.insert(consumptionHistory).values({
      id: newId(),
      bottleId,
      cellarId,
      consumedByUserId: userId,
      consumedAt: new Date().toISOString(),
      bottleNameSnapshot: 'Château Margaux',
      bottleCategorySnapshot: 'wine',
    });

    const rows = await db.select().from(bottles);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Château Margaux');

    const history = await db.select().from(consumptionHistory);
    expect(history).toHaveLength(1);
    expect(history[0].bottleNameSnapshot).toBe('Château Margaux');
  });
});
