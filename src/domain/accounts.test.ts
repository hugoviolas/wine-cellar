import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { createUserAccount, EmailAlreadyExistsError, registerSelfServeUser } from './accounts';
import { verifyPassword } from './auth';
import { users, cellars, cellarMemberships } from '../db/schema';
import { firstRow } from '../db/testRows';

describe('createUserAccount', () => {
  it('crée un compte non-admin avec le mot de passe hashé', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount({
      db,
      email: 'membre@example.com',
      password: 'mot-de-passe-membre',
    });

    const user = firstRow(await db.select().from(users).where(eq(users.id, userId)));
    expect(user.email).toBe('membre@example.com');
    expect(user.isSuperAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(await verifyPassword({ password: 'mot-de-passe-membre', hash: user.passwordHash })).toBe(true);
  });

  it('refuse un email déjà utilisé', async () => {
    const db = await createTestDb();
    await createUserAccount({ db, email: 'membre@example.com', password: 'x' });
    await expect(
      createUserAccount({ db, email: 'membre@example.com', password: 'y' }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });
});

describe('registerSelfServeUser', () => {
  it('crée un compte, une cave "Ma Cave" avec l\'IA désactivée, et une adhésion owner', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await registerSelfServeUser({
      db,
      email: 'nouveau@example.com',
      password: 'mot-de-passe-solide',
    });

    const user = firstRow(await db.select().from(users).where(eq(users.id, userId)));
    expect(user.email).toBe('nouveau@example.com');
    expect(user.isSuperAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(await verifyPassword({ password: 'mot-de-passe-solide', hash: user.passwordHash })).toBe(true);

    const cellar = firstRow(await db.select().from(cellars).where(eq(cellars.id, cellarId)));
    expect(cellar.name).toBe('Ma Cave');
    expect(cellar.ownerId).toBe(userId);
    expect(cellar.aiEnabled).toBe(false);

    const membership = firstRow(
      await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId)),
    );
    expect(membership.userId).toBe(userId);
    expect(membership.role).toBe('owner');
  });

  it('refuse un email déjà utilisé', async () => {
    const db = await createTestDb();
    await registerSelfServeUser({ db, email: 'nouveau@example.com', password: 'x'.repeat(8) });
    await expect(
      registerSelfServeUser({ db, email: 'nouveau@example.com', password: 'y'.repeat(8) }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it("normalise l'email en minuscules", async () => {
    const db = await createTestDb();
    const { userId } = await registerSelfServeUser({
      db,
      email: 'Nouveau@Example.com',
      password: 'x'.repeat(8),
    });
    const user = firstRow(await db.select().from(users).where(eq(users.id, userId)));
    expect(user.email).toBe('nouveau@example.com');
  });
});

describe('unicité de l’email, y compris en concurrence', () => {
  // La vérification d'existence et l'insertion sont deux requêtes
  // distinctes : deux inscriptions simultanées sur la même adresse peuvent
  // passer la vérification toutes les deux. C'est l'index unique de la
  // base qui tranche, et l'erreur qu'il lève doit ressortir comme un
  // conflit d'email — sinon la route répond 500 au lieu de 409.
  it('createUserAccount traduit la violation de contrainte en EmailAlreadyExistsError', async () => {
    const db = await createTestDb();
    const results = await Promise.allSettled([
      createUserAccount({ db, email: 'course@example.com', password: 'x' }),
      createUserAccount({ db, email: 'course@example.com', password: 'y' }),
    ]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === 'rejected' && rejected[0].reason).toBeInstanceOf(EmailAlreadyExistsError);
    expect(await db.select().from(users).where(eq(users.email, 'course@example.com'))).toHaveLength(1);
  });

  it('registerSelfServeUser traduit aussi la violation de contrainte', async () => {
    const db = await createTestDb();
    const results = await Promise.allSettled([
      registerSelfServeUser({ db, email: 'course2@example.com', password: 'x' }),
      registerSelfServeUser({ db, email: 'course2@example.com', password: 'y' }),
    ]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === 'rejected' && rejected[0].reason).toBeInstanceOf(EmailAlreadyExistsError);
  });
});
