import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { createUserAccount, EmailAlreadyExistsError } from './accounts';
import { verifyPassword } from './auth';
import { users } from '../db/schema';

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
