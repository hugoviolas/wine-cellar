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
    email: params.email,
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
