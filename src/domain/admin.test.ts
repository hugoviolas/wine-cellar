import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  listAllUsers,
  getUserById,
  setUserActive,
  setUserSuperAdmin,
  listAllCellarsWithOwner,
  countMembersByCellarId,
  createCellarByAdmin,
} from './admin';

describe('listAllUsers', () => {
  it('liste tous les comptes tous statuts confondus', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, { email: 'admin@example.com', password: 'x', cellarName: 'Cave' });
    await createUserAccount(db, 'membre@example.com', 'x');

    const list = await listAllUsers(db);
    expect(list).toHaveLength(2);
  });
});

describe('setUserActive', () => {
  it('désactive puis réactive un compte', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'x');

    await setUserActive(db, userId, false);
    expect((await getUserById(db, userId))?.isActive).toBe(false);

    await setUserActive(db, userId, true);
    expect((await getUserById(db, userId))?.isActive).toBe(true);
  });
});

describe('setUserSuperAdmin', () => {
  it('promeut puis rétrograde un compte', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'x');

    await setUserSuperAdmin(db, userId, true);
    expect((await getUserById(db, userId))?.isSuperAdmin).toBe(true);

    await setUserSuperAdmin(db, userId, false);
    expect((await getUserById(db, userId))?.isSuperAdmin).toBe(false);
  });
});

describe('listAllCellarsWithOwner', () => {
  it('liste toutes les caves avec l’email du owner', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });

    const list = await listAllCellarsWithOwner(db);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Cave A');
    expect(list[0].ownerEmail).toBe('a@example.com');
  });
});

describe('countMembersByCellarId', () => {
  it('compte les membres par cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });

    const counts = await countMembersByCellarId(db);
    expect(counts[cellarId]).toBe(1);
  });
});

describe('createCellarByAdmin', () => {
  it('crée une cave et son membership owner', async () => {
    const db = await createTestDb();
    const ownerId = await createUserAccount(db, 'owner@example.com', 'x');

    const cellarId = await createCellarByAdmin(db, { name: 'Nouvelle cave', ownerId });

    const list = await listAllCellarsWithOwner(db);
    expect(list.find((c) => c.id === cellarId)?.ownerEmail).toBe('owner@example.com');
    const counts = await countMembersByCellarId(db);
    expect(counts[cellarId]).toBe(1);
  });
});
