import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { checkCellarAccess } from './access';
import { users, cellarMemberships } from '../db/schema';
import { newId } from '../db/id';
import { hashPassword } from './auth';

describe('checkCellarAccess', () => {
  it('autorise le super-admin même sans membership', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    const result = await checkCellarAccess(db, userId, cellarId);
    expect(result).toEqual({ allowed: true, role: 'super_admin' });
  });

  it('autorise un membre non-admin via une vraie ligne de membership', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });

    const editorId = newId();
    await db.insert(users).values({
      id: editorId,
      email: 'editeur@example.com',
      passwordHash: await hashPassword('x'),
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    });
    await db.insert(cellarMemberships).values({
      id: newId(),
      cellarId,
      userId: editorId,
      role: 'editor',
      createdAt: new Date().toISOString(),
    });

    const result = await checkCellarAccess(db, editorId, cellarId);
    expect(result).toEqual({ allowed: true, role: 'editor' });
  });

  it('refuse un utilisateur sans lien avec la cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    const otherId = newId();
    await db.insert(users).values({
      id: otherId,
      email: 'autre@example.com',
      passwordHash: await hashPassword('x'),
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    });
    const result = await checkCellarAccess(db, otherId, cellarId);
    expect(result).toEqual({ allowed: false });
  });
});
