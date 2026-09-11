import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, cellars, cellarMemberships } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';

export class EmailAlreadyExistsError extends Error {}

export async function createUserAccount(db: Db, email: string, password: string): Promise<string> {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) throw new EmailAlreadyExistsError();

  const id = newId();
  await db.insert(users).values({
    id,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  return id;
}

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
export async function registerSelfServeUser(
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: string; cellarId: string }> {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) throw new EmailAlreadyExistsError();

  const now = new Date().toISOString();
  const userId = newId();
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    isSuperAdmin: false,
    isActive: true,
    createdAt: now,
  });

  const cellarId = newId();
  await db.insert(cellars).values({
    id: cellarId,
    name: 'Ma Cave',
    ownerId: userId,
    aiEnabled: false,
    createdAt: now,
  });

  await db.insert(cellarMemberships).values({
    id: newId(),
    cellarId,
    userId,
    role: 'owner',
    createdAt: now,
  });

  return { userId, cellarId };
}
