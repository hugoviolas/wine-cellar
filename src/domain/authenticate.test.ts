import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { authenticateUser } from './authenticate';
import { users } from '../db/schema';

describe('authenticateUser', () => {
  it('retourne l’utilisateur si email et mot de passe sont corrects', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'bon-mot-de-passe',
      cellarName: 'Ma Cave',
    });

    const user = await authenticateUser(db, 'admin@example.com', 'bon-mot-de-passe');
    expect(user).not.toBeNull();
    expect(user?.email).toBe('admin@example.com');
  });

  it('retourne null si le mot de passe est incorrect', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'bon-mot-de-passe',
      cellarName: 'Ma Cave',
    });

    expect(await authenticateUser(db, 'admin@example.com', 'mauvais')).toBeNull();
  });

  it('retourne null si l’email est inconnu', async () => {
    const db = await createTestDb();
    expect(await authenticateUser(db, 'inconnu@example.com', 'peu-importe')).toBeNull();
  });
});

describe('authenticateUser — compte désactivé', () => {
  it('retourne null pour un compte désactivé même avec le bon mot de passe', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'bon-mot-de-passe',
      cellarName: 'Ma Cave',
    });
    await db.update(users).set({ isActive: false }).where(eq(users.id, userId));

    expect(await authenticateUser(db, 'admin@example.com', 'bon-mot-de-passe')).toBeNull();
  });
});
