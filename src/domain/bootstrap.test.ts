import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { verifyPassword } from './auth';
import { authenticateUser } from './authenticate';
import { users, cellars, cellarMemberships } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('bootstrapSuperAdmin', () => {
  it('normalise l’email en minuscules pour que la connexion fonctionne', async () => {
    const db = await createTestDb();
    // authenticateUser cherche en `.toLowerCase()` : un email stocké avec
    // une majuscule créait un super-admin qui ne pouvait jamais se
    // connecter.
    const { userId } = await bootstrapSuperAdmin(db, {
      email: 'Hugo@Example.COM',
      password: 'un-mot-de-passe-solide',
      cellarName: 'Ma Cave',
    });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('hugo@example.com');

    const authed = await authenticateUser(db, 'Hugo@Example.COM', 'un-mot-de-passe-solide');
    expect(authed?.id).toBe(userId);
  });

  it('crée un utilisateur super-admin et sa première cave', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'un-mot-de-passe-solide',
      cellarName: 'Ma Cave',
    });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('admin@example.com');
    expect(user.isSuperAdmin).toBe(true);
    expect(await verifyPassword('un-mot-de-passe-solide', user.passwordHash)).toBe(true);

    const [cellar] = await db.select().from(cellars).where(eq(cellars.id, cellarId));
    expect(cellar.name).toBe('Ma Cave');
    expect(cellar.ownerId).toBe(userId);

    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.cellarId, cellarId));
    expect(membership.role).toBe('owner');
    expect(membership.userId).toBe(userId);
  });
});
