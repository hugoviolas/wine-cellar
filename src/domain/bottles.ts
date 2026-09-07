import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { bottles, crates } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails, type BottleCategory } from './bottleCategories';

export interface CreateBottleInput {
  crateId: string;
  category: BottleCategory;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  color?: string;
  abv?: number;
  volumeMl?: number;
  quantity: number;
  drinkFrom?: number;
  drinkUntil?: number;
  details: unknown;
}

export async function createBottle(db: Db, input: CreateBottleInput): Promise<string> {
  const details = parseBottleDetails(input.category, input.details);
  const id = newId();
  await db.insert(bottles).values({
    id,
    crateId: input.crateId,
    category: input.category,
    name: input.name,
    producer: input.producer ?? null,
    vintage: input.vintage ?? null,
    region: input.region ?? null,
    color: input.color ?? null,
    abv: input.abv ?? null,
    volumeMl: input.volumeMl ?? null,
    quantity: input.quantity,
    drinkFrom: input.drinkFrom ?? null,
    drinkUntil: input.drinkUntil ?? null,
    details,
    userNote: null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listBottlesByCellar(db: Db, cellarId: string) {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(eq(crates.cellarId, cellarId));
}

export async function listActiveBottlesByCellar(db: Db, cellarId: string) {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(and(eq(crates.cellarId, cellarId), gt(bottles.quantity, 0)));
}

export async function getBottle(db: Db, bottleId: string) {
  const [row] = await db.select().from(bottles).where(eq(bottles.id, bottleId)).limit(1);
  return row ?? null;
}

export interface UpdateBottleInput {
  name?: string;
  quantity?: number;
  userNote?: string | null;
  drinkFrom?: number | null;
  drinkUntil?: number | null;
  crateId?: string;
}

/**
 * Champs modifiables depuis `PATCH /api/bottles/[id]`. `.strict()` empêche
 * toute affectation de masse au-delà de cette liste précise. `crateId` est
 * volontairement autorisé (déplacer une bouteille vers une autre clayette),
 * mais la route doit vérifier que la clayette cible appartient à la même
 * cave que la clayette actuelle avant d'appeler `updateBottle` — sans quoi
 * ce champ redeviendrait le vecteur de déplacement inter-caves déjà corrigé
 * une fois (voir `PATCH /api/bottles/[id]`).
 */
export const updateBottleBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    quantity: z.number().int().min(0).optional(),
    userNote: z.string().nullable().optional(),
    drinkFrom: z.number().int().nullable().optional(),
    drinkUntil: z.number().int().nullable().optional(),
    crateId: z.string().min(1).optional(),
  })
  .strict();

export async function updateBottle(db: Db, bottleId: string, input: UpdateBottleInput): Promise<void> {
  await db.update(bottles).set(input).where(eq(bottles.id, bottleId));
}

export async function deleteBottle(db: Db, bottleId: string): Promise<void> {
  await db.delete(bottles).where(eq(bottles.id, bottleId));
}
