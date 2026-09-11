import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { verifyPassword } from './auth';
import {
  createResetToken,
  validateResetToken,
  resetPasswordWithToken,
} from './passwordReset';
import { passwordResetTokens, users } from '../db/schema';

describe('createResetToken / validateResetToken', () => {
  it('génère un token valide et non expiré', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);

    const lookup = await validateResetToken(db, token);
    expect(lookup).toEqual({ status: 'valid', userId });
  });

  it('retourne "not_found" pour un token inconnu', async () => {
    const db = await createTestDb();
    expect((await validateResetToken(db, 'inconnu')).status).toBe('not_found');
  });

  it('retourne "expired" pour un token expiré', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);
    await db
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(passwordResetTokens.token, token));

    expect((await validateResetToken(db, token)).status).toBe('expired');
  });

  it('retourne "already_used" pour un token déjà consommé', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);
    await resetPasswordWithToken(db, token, 'nouveau-mot-de-passe');

    expect((await validateResetToken(db, token)).status).toBe('already_used');
  });
});

describe('resetPasswordWithToken', () => {
  it('met à jour le mot de passe et consomme le token', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'ancien', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);

    await resetPasswordWithToken(db, token, 'nouveau-mot-de-passe');

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(await verifyPassword('nouveau-mot-de-passe', user.passwordHash)).toBe(true);
    expect(await verifyPassword('ancien', user.passwordHash)).toBe(false);
  });

  it('rejette un token invalide', async () => {
    const db = await createTestDb();
    await expect(resetPasswordWithToken(db, 'inconnu', 'x')).rejects.toThrow();
  });
});
