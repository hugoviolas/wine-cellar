import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';

export async function listAllUsers(db: Db) {
  return db.select().from(users);
}

export async function getUserById(db: Db, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function setUserActive(db: Db, userId: string, isActive: boolean): Promise<void> {
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

export async function setUserSuperAdmin(db: Db, userId: string, isSuperAdmin: boolean): Promise<void> {
  await db.update(users).set({ isSuperAdmin }).where(eq(users.id, userId));
}
