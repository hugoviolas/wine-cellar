import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  createWishlistItem,
  listWishlistItems,
  getWishlistItem,
  resolveWishlistItemAccess,
  updateWishlistItem,
  updateWishlistItemBodySchema,
  deleteWishlistItem,
} from './wishlist';

describe('createWishlistItem / getWishlistItem', () => {
  it('creates item with valid details for category', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    const id = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' },
    });

    const item = await getWishlistItem(db, id);
    expect(item?.name).toBe('Clos Poggiale');
    expect(item?.userId).toBe(userId);
    expect(item?.status).toBe('pending');
    expect(item?.promotedBottleId).toBeNull();
    expect(item?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });

  it('rejects invalid details for category', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    await expect(
      createWishlistItem(db, { userId, category: 'cider', name: 'Cidre', details: { method: 'industriel' } }),
    ).rejects.toThrow();
  });
});

describe('listWishlistItems', () => {
  it('returns only items for requested user, newest first', async () => {
    const db = await createTestDb();
    const { userId: userA } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });
    const userB = await createUserAccount(db, 'b@example.com', 'password123');

    await createWishlistItem(db, { userId: userA, category: 'wine', name: 'Premier', details: {} });
    await createWishlistItem(db, { userId: userA, category: 'wine', name: 'Second', details: {} });
    await createWishlistItem(db, { userId: userB, category: 'wine', name: 'Not mine', details: {} });

    const items = await listWishlistItems(db, userA);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Second');
    expect(items[1].name).toBe('Premier');
  });
});

describe('resolveWishlistItemAccess', () => {
  it('returns ok for owner', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'wine', name: 'Wine', details: {} });

    const access = await resolveWishlistItemAccess(db, userId, id);
    expect(access.status).toBe('ok');
  });

  it('returns not_found for unknown id', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const access = await resolveWishlistItemAccess(db, userId, 'unknown');
    expect(access.status).toBe('not_found');
  });

  it('returns forbidden for different user, even if super-admin', async () => {
    const db = await createTestDb();
    const { userId: owner } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId: owner, category: 'wine', name: 'Wine', details: {} });

    // Use bootstrapSuperAdmin to create a second super-admin account
    // This proves there is no super-admin bypass, not just that
    // regular users fail for a different reason.
    const { userId: otherSuperAdmin } = await bootstrapSuperAdmin(db, { email: 'admin2@example.com', password: 'x', cellarName: 'Another cellar' });
    const access = await resolveWishlistItemAccess(db, otherSuperAdmin, id);
    expect(access.status).toBe('forbidden');
  });
});

describe('updateWishlistItem', () => {
  it('updates identity fields and details', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'wine', name: 'Wine', details: {} });

    await updateWishlistItem(db, id, {
      name: 'Clos Poggiale',
      producer: 'Domaine Poggiale',
      vintage: 2023,
      details: { grapeVarieties: ['Niellucciu'], appellation: 'Patrimonio' },
    });

    const item = await getWishlistItem(db, id);
    expect(item?.name).toBe('Clos Poggiale');
    expect(item?.producer).toBe('Domaine Poggiale');
    expect(item?.vintage).toBe(2023);
    expect(item?.details).toEqual({ grapeVarieties: ['Niellucciu'], appellation: 'Patrimonio' });
  });
});

describe('updateWishlistItemBodySchema', () => {
  it('rejects unknown key', () => {
    expect(updateWishlistItemBodySchema.safeParse({ notAField: 'x' }).success).toBe(false);
  });

  it('accepts partial update', () => {
    expect(updateWishlistItemBodySchema.safeParse({ name: 'New name' }).success).toBe(true);
  });

  it('rejects category (immutable)', () => {
    expect(updateWishlistItemBodySchema.safeParse({ category: 'beer' }).success).toBe(false);
  });
});

describe('deleteWishlistItem', () => {
  it('deletes an item', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'wine', name: 'Wine', details: {} });

    await deleteWishlistItem(db, id);
    expect(await getWishlistItem(db, id)).toBeNull();
  });
});
