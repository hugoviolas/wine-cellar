import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, cellars, cellarMemberships } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';

export class EmailAlreadyExistsError extends Error {}

/**
 * Vrai si l'erreur vient de l'index unique sur `users.email`.
 *
 * La vérification d'existence faite plus bas et l'insertion sont deux
 * requêtes distinctes : entre les deux, une autre inscription sur la même
 * adresse peut passer. L'index unique de la base est le seul arbitre réel,
 * et l'erreur qu'il lève doit ressortir comme un conflit d'email — sinon
 * la route répond 500 là où elle sait répondre 409.
 *
 * Le message est inspecté faute de code d'erreur exploitable : libsql
 * enveloppe l'erreur SQLite dans une `Error` générique dont seul le texte
 * porte la contrainte violée.
 */
const isEmailUniqueViolation = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const text = `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`;
  return text.includes('UNIQUE constraint failed: users.email');
};

export const createUserAccount = async (db: Db, email: string, password: string): Promise<string> => {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const id = newId();
  try {
    await db.insert(users).values({
      id,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      isSuperAdmin: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    if (isEmailUniqueViolation(error)) {
      throw new EmailAlreadyExistsError();
    }
    throw error;
  }
  return id;
};

/**
 * Inscription libre (page publique /signup) : crée un compte, une nouvelle
 * cave dont l'utilisateur est owner, et l'adhésion correspondante — en un
 * seul geste, sans intervention du super-admin. Contrairement à
 * bootstrapSuperAdmin (réservé au tout premier compte, via script CLI) :
 * isSuperAdmin toujours false, et aiEnabled toujours false sur la cave
 * créée — l'inscription étant ouverte à n'importe qui, une nouvelle cave
 * ne doit pas avoir accès par défaut à la clé API IA partagée (le
 * super-admin l'active au cas par cas depuis /admin/caves).
 */
export const registerSelfServeUser = async (
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: string; cellarId: string }> => {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const now = new Date().toISOString();
  const userId = newId();
  const cellarId = newId();
  // Hachage avant la transaction : bcrypt en coût 12 prend quelques
  // centaines de millisecondes, pendant lesquelles la transaction
  // tiendrait le verrou d'écriture de SQLite sans rien faire d'utile.
  const passwordHash = await hashPassword(password);

  try {
    // Les trois insertions ensemble : un échec après la création du compte
    // laissait un utilisateur sans cave ni adhésion, donc connecté sur une
    // application vide, sans moyen d'en sortir ni de recommencer —
    // son adresse étant désormais prise.
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        passwordHash,
        isSuperAdmin: false,
        isActive: true,
        createdAt: now,
      });

      await tx.insert(cellars).values({
        id: cellarId,
        name: 'Ma Cave',
        ownerId: userId,
        aiEnabled: false,
        createdAt: now,
      });

      await tx.insert(cellarMemberships).values({
        id: newId(),
        cellarId,
        userId,
        role: 'owner',
        createdAt: now,
      });
    });
  } catch (error: unknown) {
    if (isEmailUniqueViolation(error)) {
      throw new EmailAlreadyExistsError();
    }
    throw error;
  }

  return { userId, cellarId };
};
