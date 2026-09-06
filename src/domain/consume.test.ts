import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle, getBottle } from './bottles';
import { consumeBottle, BottleUnavailableError } from './consume';
import { consumptionHistory } from '../db/schema';

describe('consumeBottle', () => {
  it('décrémente la quantité et crée une entrée d’historique', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });

    await consumeBottle(db, {
      bottleId,
      consumedByUserId: userId,
      consumedAt: '2026-09-06',
      rating: 4,
      comment: 'Excellent',
      occasion: 'Dîner',
    });

    const bottle = await getBottle(db, bottleId);
    expect(bottle?.quantity).toBe(1);

    const history = await db.select().from(consumptionHistory).where(eq(consumptionHistory.bottleId, bottleId));
    expect(history).toHaveLength(1);
    expect(history[0].rating).toBe(4);
    expect(history[0].bottleNameSnapshot).toBe('Vin');
    expect(history[0].cellarId).toBe(cellarId);
  });

  it('refuse de consommer une bouteille épuisée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 0, details: {} });

    await expect(
      consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: '2026-09-06' }),
    ).rejects.toBeInstanceOf(BottleUnavailableError);

    const history = await db.select().from(consumptionHistory).where(eq(consumptionHistory.bottleId, bottleId));
    expect(history).toHaveLength(0);
  });

  it('conserve la ligne de bouteille à quantité 0 après la dernière consommation', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: '2026-09-06' });

    const bottle = await getBottle(db, bottleId);
    expect(bottle).not.toBeNull();
    expect(bottle?.quantity).toBe(0);
  });
});
