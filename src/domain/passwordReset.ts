import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { passwordResetTokens, users } from '../db/schema';
import { newId } from '../db/id';
import { generateToken } from './token';
import { hashPassword } from './auth';

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export async function createResetToken(db: Db, userId: string): Promise<string> {
  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    id: newId(),
    userId,
    token,
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  });
  return token;
}

export type ResetTokenLookup =
  | { status: 'valid'; userId: string }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_used' };

export async function validateResetToken(db: Db, token: string): Promise<ResetTokenLookup> {
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
  if (!row) return { status: 'not_found' };
  if (row.usedAt) return { status: 'already_used' };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { status: 'expired' };
  return { status: 'valid', userId: row.userId };
}

export async function resetPasswordWithToken(db: Db, token: string, newPassword: string): Promise<void> {
  const lookup = await validateResetToken(db, token);
  if (lookup.status !== 'valid') {
    throw new Error('Lien de réinitialisation invalide.');
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, lookup.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordResetTokens.token, token));
}
