import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  listAllUsers,
  getUserById,
  setUserActive,
  setUserSuperAdmin,
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
