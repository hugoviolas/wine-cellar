import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle } from './bottles';
import { consumeBottle } from './consume';
import { listConsumptionHistory } from './history';

describe('listConsumptionHistory', () => {
  it('retourne uniquement l’historique de la cave demandée, du plus récent au plus ancien', async () => {
    const db = await createTestDb();
    const caveA = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });
    const caveB = await bootstrapSuperAdmin(db, { email: 'b@example.com', password: 'x', cellarName: 'Cave B' });

    const crateA = await createCrate(db, { cellarId: caveA.cellarId, name: 'C1', capacity: 6 });
    const crateB = await createCrate(db, { cellarId: caveB.cellarId, name: 'C1', capacity: 6 });

    const bottleA1 = await createBottle(db, { crateId: crateA, category: 'wine', name: 'Vin A1', quantity: 2, details: {} });
    const bottleA2 = await createBottle(db, { crateId: crateA, category: 'wine', name: 'Vin A2', quantity: 1, details: {} });
    const bottleB = await createBottle(db, { crateId: crateB, category: 'wine', name: 'Vin B', quantity: 1, details: {} });

    await consumeBottle(db, { bottleId: bottleA1, consumedByUserId: caveA.userId, consumedAt: '2026-01-01' });
    await consumeBottle(db, { bottleId: bottleA2, consumedByUserId: caveA.userId, consumedAt: '2026-06-01' });
    await consumeBottle(db, { bottleId: bottleB, consumedByUserId: caveB.userId, consumedAt: '2026-03-01' });

    const historyA = await listConsumptionHistory(db, caveA.cellarId);
    expect(historyA).toHaveLength(2);
    expect(historyA[0].bottleNameSnapshot).toBe('Vin A2');
    expect(historyA[1].bottleNameSnapshot).toBe('Vin A1');
  });
});
