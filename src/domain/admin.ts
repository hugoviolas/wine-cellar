import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, cellars, cellarMemberships } from '../db/schema';
import { newId } from '../db/id';

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

export async function listAllCellarsWithOwner(db: Db) {
  return db
    .select({
      id: cellars.id,
      name: cellars.name,
      ownerId: cellars.ownerId,
      ownerEmail: users.email,
      createdAt: cellars.createdAt,
    })
    .from(cellars)
    .innerJoin(users, eq(cellars.ownerId, users.id));
}

export async function countMembersByCellarId(db: Db): Promise<Record<string, number>> {
  const rows = await db.select({ cellarId: cellarMemberships.cellarId }).from(cellarMemberships);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.cellarId] = (counts[row.cellarId] ?? 0) + 1;
  }
  return counts;
}

export interface CreateCellarInput {
  name: string;
  ownerId: string;
}

export async function createCellarByAdmin(db: Db, input: CreateCellarInput): Promise<string> {
  const id = newId();
  const now = new Date().toISOString();
  await db.insert(cellars).values({
    id,
    name: input.name,
    ownerId: input.ownerId,
    aiEnabled: true,
    createdAt: now,
  });
  await db.insert(cellarMemberships).values({
    id: newId(),
    cellarId: id,
    userId: input.ownerId,
    role: 'owner',
    createdAt: now,
  });
  return id;
}
