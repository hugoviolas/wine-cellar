import type { Db } from '../db/client';
import { users, cellars, cellarMemberships } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';

export interface BootstrapParams {
  email: string;
  password: string;
  cellarName: string;
}

export async function bootstrapSuperAdmin(db: Db, params: BootstrapParams) {
  const now = new Date().toISOString();
  const userId = newId();
  await db.insert(users).values({
    id: userId,
    // Minuscules, comme createUserAccount et registerSelfServeUser :
    // authenticateUser cherche l'email en `.toLowerCase()`, donc un
    // BOOTSTRAP_EMAIL contenant une majuscule créait jusqu'ici un
    // super-admin incapable de se connecter.
    email: params.email.toLowerCase(),
    passwordHash: await hashPassword(params.password),
    isSuperAdmin: true,
    createdAt: now,
  });

  const cellarId = newId();
  await db.insert(cellars).values({
    id: cellarId,
    name: params.cellarName,
    ownerId: userId,
    aiEnabled: true,
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
