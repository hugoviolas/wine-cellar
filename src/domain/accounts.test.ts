import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { createUserAccount, EmailAlreadyExistsError, registerSelfServeUser } from './accounts';
import { verifyPassword } from './auth';
import { users, cellars, cellarMemberships } from '../db/schema';

describe('createUserAccount', () => {
  it('crée un compte non-admin avec le mot de passe hashé', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'mot-de-passe-membre');

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('membre@example.com');
    expect(user.isSuperAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(await verifyPassword('mot-de-passe-membre', user.passwordHash)).toBe(true);
  });

  it('refuse un email déjà utilisé', async () => {
    const db = await createTestDb();
    await createUserAccount(db, 'membre@example.com', 'x');
    await expect(createUserAccount(db, 'membre@example.com', 'y')).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });
});

describe('registerSelfServeUser', () => {
  it('crée un compte, une cave "Ma Cave" avec l\'IA désactivée, et une adhésion owner', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await registerSelfServeUser(db, 'nouveau@example.com', 'mot-de-passe-solide');

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('nouveau@example.com');
    expect(user.isSuperAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(await verifyPassword('mot-de-passe-solide', user.passwordHash)).toBe(true);

    const [cellar] = await db.select().from(cellars).where(eq(cellars.id, cellarId));
    expect(cellar.name).toBe('Ma Cave');
    expect(cellar.ownerId).toBe(userId);
    expect(cellar.aiEnabled).toBe(false);

    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.cellarId, cellarId));
    expect(membership.userId).toBe(userId);
    expect(membership.role).toBe('owner');
  });

  it('refuse un email déjà utilisé', async () => {
    const db = await createTestDb();
    await registerSelfServeUser(db, 'nouveau@example.com', 'x'.repeat(8));
    await expect(registerSelfServeUser(db, 'nouveau@example.com', 'y'.repeat(8))).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('normalise l\'email en minuscules', async () => {
    const db = await createTestDb();
    const { userId } = await registerSelfServeUser(db, 'Nouveau@Example.com', 'x'.repeat(8));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('nouveau@example.com');
  });
});
