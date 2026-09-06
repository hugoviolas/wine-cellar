import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { crates } from '../db/schema';
import { newId } from '../db/id';

export interface CreateCrateInput {
  cellarId: string;
  name: string;
  capacity: number;
}

export async function createCrate(db: Db, input: CreateCrateInput): Promise<string> {
  const id = newId();
  await db.insert(crates).values({
    id,
    cellarId: input.cellarId,
    name: input.name,
    capacity: input.capacity,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listCrates(db: Db, cellarId: string) {
  return db.select().from(crates).where(eq(crates.cellarId, cellarId)).orderBy(crates.sortOrder);
}

export async function renameCrate(db: Db, crateId: string, name: string): Promise<void> {
  await db.update(crates).set({ name }).where(eq(crates.id, crateId));
}

export async function deleteCrate(db: Db, crateId: string): Promise<void> {
  await db.delete(crates).where(eq(crates.id, crateId));
}
