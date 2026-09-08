import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { createCrate, deleteCrate } from './crates';
import { createBottle } from './bottles';
import { consumeBottle } from './consume';
import {
  listConsumptionHistory,
  resolveHistoryEntryAccess,
  updateHistoryEntry,
  deleteHistoryEntry,
  updateHistoryEntryBodySchema,
} from './history';

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

  it('signale une bouteille comme injoignable si sa clayette a depuis été supprimée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette', capacity: 6 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: '2026-01-01' });
    await deleteCrate(db, crateId);

    const history = await listConsumptionHistory(db, cellarId);
    expect(history).toHaveLength(1);
    expect(history[0].bottleId).toBe(bottleId);
    expect(history[0].bottleReachable).toBeNull();
  });

  it('signale une bouteille comme joignable tant que sa clayette existe encore', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette', capacity: 6 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });

    await consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: '2026-01-01' });

    const history = await listConsumptionHistory(db, cellarId);
    expect(history[0].bottleReachable).toBe(crateId);
  });
});

async function setupHistoryEntry() {
  const db = await createTestDb();
  const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
  const crateId = await createCrate(db, { cellarId, name: 'Clayette', capacity: 6 });
  const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });
  await consumeBottle(db, {
    bottleId,
    consumedByUserId: userId,
    consumedAt: '2026-01-01',
    quantity: 1,
    rating: 3,
    comment: 'Correct',
    occasion: 'Repas',
  });
  const [entry] = await listConsumptionHistory(db, cellarId);
  return { db, userId, cellarId, entry };
}

describe('resolveHistoryEntryAccess', () => {
  it('autorise un membre de la cave', async () => {
    const { db, userId, entry } = await setupHistoryEntry();

    const result = await resolveHistoryEntryAccess(db, userId, entry.id);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('accès inattendu');
    expect(result.entry.id).toBe(entry.id);
    expect(result.role).toBe('super_admin');
  });

  it('refuse un utilisateur sans lien avec la cave', async () => {
    const { db, entry } = await setupHistoryEntry();
    const outsiderId = await createUserAccount(db, 'outsider@example.com', 'x');

    const result = await resolveHistoryEntryAccess(db, outsiderId, entry.id);
    expect(result).toEqual({ status: 'forbidden' });
  });

  it('retourne not_found pour une entrée inconnue', async () => {
    const { db, userId } = await setupHistoryEntry();

    const result = await resolveHistoryEntryAccess(db, userId, 'entree-inconnue');
    expect(result).toEqual({ status: 'not_found' });
  });
});

describe('updateHistoryEntryBodySchema', () => {
  it('accepte un patch partiel', () => {
    expect(updateHistoryEntryBodySchema.safeParse({ comment: 'Excellent' }).success).toBe(true);
  });

  it('refuse un champ inconnu (.strict())', () => {
    expect(updateHistoryEntryBodySchema.safeParse({ bottleNameSnapshot: 'Triché' }).success).toBe(false);
  });

  it('refuse une note hors 0-5', () => {
    expect(updateHistoryEntryBodySchema.safeParse({ rating: 6 }).success).toBe(false);
  });
});

describe('updateHistoryEntry', () => {
  it('met à jour les champs modifiables sans toucher aux snapshots', async () => {
    const { db, entry } = await setupHistoryEntry();

    await updateHistoryEntry(db, entry.id, { comment: 'Finalement excellent', rating: 5, occasion: 'Anniversaire' });

    const [updated] = await listConsumptionHistory(db, entry.cellarId);
    expect(updated.comment).toBe('Finalement excellent');
    expect(updated.rating).toBe(5);
    expect(updated.occasion).toBe('Anniversaire');
    expect(updated.bottleNameSnapshot).toBe('Vin');
  });
});

describe('deleteHistoryEntry', () => {
  it('supprime l’entrée', async () => {
    const { db, entry } = await setupHistoryEntry();

    await deleteHistoryEntry(db, entry.id);

    expect(await listConsumptionHistory(db, entry.cellarId)).toHaveLength(0);
  });
});
