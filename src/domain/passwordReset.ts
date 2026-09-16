import { eq } from 'drizzle-orm';
import { passwordResetTokens, users } from '../db/schema';
import { newId } from '../db/id';
import { generateToken, hashToken } from './token';
import { hashPassword } from './auth';
import type { CreateResetTokenArgs } from './interfaces/create-reset-token-args.interface';
import type { ValidateResetTokenArgs } from './interfaces/validate-reset-token-args.interface';
import type { ResetPasswordWithTokenArgs } from './interfaces/reset-password-with-token-args.interface';

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export const createResetToken = async ({ db, userId }: CreateResetTokenArgs): Promise<string> => {
  // Le jeton n'existe qu'ici et dans le lien remis au super-admin : la
  // base ne reçoit que son empreinte (voir domain/token.ts).
  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    id: newId(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  });
  return token;
};

export type ResetTokenLookup =
  | { status: 'valid'; userId: string }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_used' };

export const validateResetToken = async ({
  db,
  token,
}: ValidateResetTokenArgs): Promise<ResetTokenLookup> => {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, hashToken(token)))
    .limit(1);
  // `userId` nul : le compte a été supprimé depuis (voir deleteUser dans
  // domain/admin.ts, qui met les jetons de réinitialisation orphelins à
  // `null` plutôt que de les supprimer) — un jeton sans compte associé
  // n'a plus de sens, traité comme introuvable.
  if (!row || row.userId === null) {
    return { status: 'not_found' };
  }
  if (row.usedAt) {
    return { status: 'already_used' };
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return { status: 'expired' };
  }
  return { status: 'valid', userId: row.userId };
};

export const resetPasswordWithToken = async ({
  db,
  token,
  newPassword,
}: ResetPasswordWithTokenArgs): Promise<void> => {
  const lookup = await validateResetToken({ db, token });
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
    .where(eq(passwordResetTokens.tokenHash, hashToken(token)));
};
