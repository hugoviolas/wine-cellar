import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { crates, bottles } from '../db/schema';
import { newId } from '../db/id';

export interface CreateCrateInput {
  cellarId: string;
  name: string;
  capacity: number;
}

/** Corps attendu par `POST /api/crates`, validé avant tout contrôle d'accès. */
export const createCrateBodySchema = z
  .object({
    cellarId: z.string().min(1),
    name: z.string().min(1),
    capacity: z.number().int().positive(),
  })
  .strict();

/**
 * Plus petit numéro de clayette non utilisé dans la cave : un numéro libéré
 * par une suppression est réutilisé plutôt que de décaler les autres.
 */
async function nextAvailableCrateNumber(db: Db, cellarId: string): Promise<number> {
  const rows = await db
    .select({ number: crates.number })
    .from(crates)
    .where(eq(crates.cellarId, cellarId));
  const used = new Set(rows.map((r) => r.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export async function createCrate(db: Db, input: CreateCrateInput): Promise<string> {
  const id = newId();
  const number = await nextAvailableCrateNumber(db, input.cellarId);
  await db.insert(crates).values({
    id,
    cellarId: input.cellarId,
    number,
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

/**
 * Applique un nouvel ordre d'affichage (glisser-déposer). `orderedIds` doit
 * contenir exactement les clayettes de `cellarId`, dans le nouvel ordre —
 * sinon la fonction échoue sans rien modifier, pour ne pas laisser une
 * clayette d'une autre cave se faire réordonner par erreur.
 */
export async function reorderCrates(db: Db, cellarId: string, orderedIds: string[]): Promise<void> {
  const existing = await listCrates(db, cellarId);
  const existingIds = new Set(existing.map((c) => c.id));
  const sameSet =
    orderedIds.length === existing.length && orderedIds.every((id) => existingIds.has(id));
  if (!sameSet) {
    throw new Error('La liste fournie ne correspond pas exactement aux clayettes de cette cave.');
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(crates).set({ sortOrder: i }).where(eq(crates.id, orderedIds[i]));
  }
}

export async function renameCrate(db: Db, crateId: string, name: string): Promise<void> {
  await db.update(crates).set({ name }).where(eq(crates.id, crateId));
}

/** Vrai si la clayette contient encore au moins une bouteille en stock (quantité > 0). */
export async function crateHasActiveBottles(db: Db, crateId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(and(eq(bottles.crateId, crateId), gt(bottles.quantity, 0)))
    .limit(1);
  return row !== undefined;
}

export async function deleteCrate(db: Db, crateId: string): Promise<void> {
  await db.delete(crates).where(eq(crates.id, crateId));
}

export async function getCrateById(db: Db, crateId: string) {
  const [row] = await db.select().from(crates).where(eq(crates.id, crateId)).limit(1);
  return row ?? null;
}
