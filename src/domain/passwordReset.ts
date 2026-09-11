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
  // `userId` nul : le compte a été supprimé depuis (voir deleteUser dans
  // domain/admin.ts, qui met les jetons de réinitialisation orphelins à
  // `null` plutôt que de les supprimer) — un jeton sans compte associé
  // n'a plus de sens, traité comme introuvable.
  if (!row || row.userId === null) return { status: 'not_found' };
  if (row.usedAt) return { status: 'already_used' };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { status: 'expired' };
  return { status: 'valid', userId: row.userId };
}

export async function resetPasswordWithToken(db: Db, token: string, newPassword: string): Promise<void> {
  const lookup = await validateResetToken(db, token);
  if (lookup.status !== 'valid') {
    throw new Error('Lien de réinitialisation invalide.');
  }
  // `sessionsValidFrom` en même temps que le hash : sans ça, changer le mot
  // de passe d'un compte compromis laisserait les sessions déjà ouvertes de
  // l'attaquant parfaitement valides (voir domain/sessionValidity.ts).
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      sessionsValidFrom: new Date().toISOString(),
    })
    .where(eq(users.id, lookup.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordResetTokens.token, token));
}
