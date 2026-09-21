import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { createCrate, deleteCrate } from './crates';
import { createBottle } from './bottles';
import { consumeBottle } from './consume';
import {
  listBottleConsumptions,
  listConsumptionHistory,
  resolveHistoryEntryAccess,
  updateHistoryEntry,
  deleteHistoryEntry,
  updateHistoryEntryBodySchema,
} from './history';
import { firstRow, rowAt } from '../db/testRows';
import type { Db } from '../db/client';
import type { HistoryEntryWithReachability } from './interfaces/history-entry-with-reachability.interface';

describe('listConsumptionHistory', () => {
  it('retourne uniquement l’historique de la cave demandée, du plus récent au plus ancien', async () => {
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

    const crateA = await createCrate({ db, input: { cellarId: caveA.cellarId, name: 'C1', capacity: 6 } });
    const crateB = await createCrate({ db, input: { cellarId: caveB.cellarId, name: 'C1', capacity: 6 } });

    const bottleA1 = await createBottle({
      db,
      input: {
        crateId: crateA,
        category: 'wine',
        name: 'Vin A1',
        quantity: 2,
        details: {},
      },
    });
    const bottleA2 = await createBottle({
      db,
      input: {
        crateId: crateA,
        category: 'wine',
        name: 'Vin A2',
        quantity: 1,
        details: {},
      },
    });
    const bottleB = await createBottle({
      db,
      input: {
        crateId: crateB,
        category: 'wine',
        name: 'Vin B',
        quantity: 1,
        details: {},
      },
    });

    await consumeBottle({
      db,
      input: { bottleId: bottleA1, consumedByUserId: caveA.userId, consumedAt: '2026-01-01' },
    });
    await consumeBottle({
      db,
      input: { bottleId: bottleA2, consumedByUserId: caveA.userId, consumedAt: '2026-06-01' },
    });
    await consumeBottle({
      db,
      input: { bottleId: bottleB, consumedByUserId: caveB.userId, consumedAt: '2026-03-01' },
    });

    const historyA = await listConsumptionHistory({ db, cellarId: caveA.cellarId });
    expect(historyA).toHaveLength(2);
    expect(rowAt(historyA, 0).bottleNameSnapshot).toBe('Vin A2');
    expect(rowAt(historyA, 1).bottleNameSnapshot).toBe('Vin A1');
  });

  it('signale une bouteille comme injoignable si sa clayette a depuis été supprimée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette', capacity: 6 } });
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

    await consumeBottle({ db, input: { bottleId, consumedByUserId: userId, consumedAt: '2026-01-01' } });
    await deleteCrate({ db, crateId });

    const history = await listConsumptionHistory({ db, cellarId });
    expect(history).toHaveLength(1);
    expect(rowAt(history, 0).bottleId).toBe(bottleId);
    expect(rowAt(history, 0).bottleReachable).toBeNull();
  });

  it('signale une bouteille comme joignable tant que sa clayette existe encore', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette', capacity: 6 } });
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

    await consumeBottle({ db, input: { bottleId, consumedByUserId: userId, consumedAt: '2026-01-01' } });

    const history = await listConsumptionHistory({ db, cellarId });
    expect(rowAt(history, 0).bottleReachable).toBe(crateId);
  });
});

interface SetupHistoryEntryResult {
  db: Db;
  userId: string;
  cellarId: string;
  entry: HistoryEntryWithReachability;
}

const setupHistoryEntry = async (): Promise<SetupHistoryEntryResult> => {
  const db = await createTestDb();
  const { userId, cellarId } = await bootstrapSuperAdmin({
    db,
    params: {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    },
  });
  const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette', capacity: 6 } });
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
  await consumeBottle({
    db,
    input: {
      bottleId,
      consumedByUserId: userId,
      consumedAt: '2026-01-01',
      quantity: 1,
      rating: 3,
      comment: 'Correct',
      occasion: 'Repas',
    },
  });
  const entry = firstRow(await listConsumptionHistory({ db, cellarId }));
  return { db, userId, cellarId, entry };
};

describe('listBottleConsumptions', () => {
  it('ne retourne que les consommations de la bouteille demandée, du plus récent au plus ancien', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'Cave' },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette', capacity: 6 } });
    const bottleId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Vin suivi', quantity: 3, details: {} },
    });
    const autreId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Autre vin', quantity: 1, details: {} },
    });

    await consumeBottle({
      db,
      input: {
        bottleId,
        consumedByUserId: userId,
        consumedAt: '2026-01-01',
        comment: 'Sur un gigot.',
      },
    });
    await consumeBottle({
      db,
      input: {
        bottleId,
        consumedByUserId: userId,
        consumedAt: '2026-06-01',
        comment: 'Encore meilleur.',
        rating: 5,
      },
    });
    await consumeBottle({
      db,
      input: { bottleId: autreId, consumedByUserId: userId, consumedAt: '2026-03-01' },
    });

    const entries = await listBottleConsumptions({ db, bottleId });
    expect(entries).toHaveLength(2);
    expect(rowAt(entries, 0).comment).toBe('Encore meilleur.');
    expect(rowAt(entries, 0).rating).toBe(5);
    expect(rowAt(entries, 1).comment).toBe('Sur un gigot.');
  });

  it('retourne une liste vide pour une bouteille jamais consommée', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'Cave' },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette', capacity: 6 } });
    const bottleId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Vin intact', quantity: 1, details: {} },
    });

    expect(await listBottleConsumptions({ db, bottleId })).toEqual([]);
  });
});

describe('resolveHistoryEntryAccess', () => {
  it('autorise un membre de la cave', async () => {
    const { db, userId, entry } = await setupHistoryEntry();

    const result = await resolveHistoryEntryAccess({ db, userId, entryId: entry.id });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      throw new Error('accès inattendu');
    }
    expect(result.entry.id).toBe(entry.id);
    expect(result.role).toBe('super_admin');
  });

  it('refuse un utilisateur sans lien avec la cave', async () => {
    const { db, entry } = await setupHistoryEntry();
    const outsiderId = await createUserAccount({ db, email: 'outsider@example.com', password: 'x' });

    const result = await resolveHistoryEntryAccess({ db, userId: outsiderId, entryId: entry.id });
    expect(result).toEqual({ status: 'forbidden' });
  });

  it('retourne not_found pour une entrée inconnue', async () => {
    const { db, userId } = await setupHistoryEntry();

    const result = await resolveHistoryEntryAccess({ db, userId, entryId: 'entree-inconnue' });
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

    await updateHistoryEntry({
      db,
      entryId: entry.id,
      input: {
        comment: 'Finalement excellent',
        rating: 5,
        occasion: 'Anniversaire',
      },
    });

    const updated = firstRow(await listConsumptionHistory({ db, cellarId: entry.cellarId }));
    expect(updated.comment).toBe('Finalement excellent');
    expect(updated.rating).toBe(5);
    expect(updated.occasion).toBe('Anniversaire');
    expect(updated.bottleNameSnapshot).toBe('Vin');
  });
});

describe('deleteHistoryEntry', () => {
  it('supprime l’entrée', async () => {
    const { db, entry } = await setupHistoryEntry();

    await deleteHistoryEntry({ db, entryId: entry.id });

    expect(await listConsumptionHistory({ db, cellarId: entry.cellarId })).toHaveLength(0);
  });
});
