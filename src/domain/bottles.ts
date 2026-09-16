import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, DbOrTx } from '../db/client';
import { bottles, crates } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails } from './bottleCategories';
import type { BottleRow } from '../db/rows';
import type { BottleWithCrate } from './interfaces/bottle-with-crate.interface';
import type { CreateBottleInput } from './interfaces/create-bottle-input.interface';
import type { UpdateBottleInput } from './interfaces/update-bottle-input.interface';

export type { CreateBottleInput, UpdateBottleInput };

/**
 * Corps attendu par `POST /api/bottles`. `.strict()` + typage explicite :
 * sans ça la route insérait le corps brut, et SQLite (typage dynamique)
 * acceptait sans broncher une `quantity` négative ou un `abv` textuel dans
 * une colonne `real`. `details` reste `unknown` ici — sa forme dépend de la
 * catégorie et n'est validée que par `parseBottleDetails`, appelé dans
 * `createBottle`.
 */
export const createBottleBodySchema = z
  .object({
    crateId: z.string().min(1),
    category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']),
    name: z.string().min(1),
    producer: z.string().optional(),
    vintage: z.number().int().optional(),
    region: z.string().optional(),
    color: z.string().optional(),
    abv: z.number().nonnegative().optional(),
    volumeMl: z.number().int().positive().optional(),
    quantity: z.number().int().min(0),
    drinkFrom: z.number().int().optional(),
    drinkUntil: z.number().int().optional(),
    details: z.unknown(),
  })
  .strict();

export const createBottle = async (db: DbOrTx, input: CreateBottleInput): Promise<string> => {
  const details = parseBottleDetails(input.category, input.details);
  const id = newId();
  const siblingCount = (
    await db.select({ id: bottles.id }).from(bottles).where(eq(bottles.crateId, input.crateId))
  ).length;
  await db.insert(bottles).values({
    id,
    crateId: input.crateId,
    sortOrder: siblingCount,
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
    userNote: input.userNote?.trim() || null,
    aiAnalysis: input.aiAnalysis ?? null,
    aiPairings: input.aiPairings ?? null,
    aiTastingAdvice: input.aiTastingAdvice ?? null,
    aiGeneratedAt: input.aiGeneratedAt ?? null,
    createdAt: new Date().toISOString(),
  });
  return id;
};

export const listBottlesByCellar = async (db: Db, cellarId: string): Promise<BottleWithCrate[]> => {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(eq(crates.cellarId, cellarId))
    .orderBy(bottles.sortOrder);
};

export const listActiveBottlesByCellar = async (db: Db, cellarId: string): Promise<BottleWithCrate[]> => {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(and(eq(crates.cellarId, cellarId), gt(bottles.quantity, 0)))
    .orderBy(bottles.sortOrder);
};

export const getBottle = async (db: Db, bottleId: string): Promise<BottleRow | null> => {
  const [row] = await db.select().from(bottles).where(eq(bottles.id, bottleId)).limit(1);
  return row ?? null;
};

/**
 * Champs modifiables depuis `PATCH /api/bottles/[id]`. `.strict()` empêche
 * toute affectation de masse au-delà de cette liste précise. `crateId` est
 * volontairement autorisé (déplacer une bouteille vers une autre clayette),
 * mais la route doit vérifier que la clayette cible appartient à la même
 * cave que la clayette actuelle avant d'appeler `updateBottle` — sans quoi
 * ce champ redeviendrait le vecteur de déplacement inter-caves déjà corrigé
 * une fois (voir `PATCH /api/bottles/[id]`). `details` (cépages,
 * appellation...) n'est validé qu'ici comme JSON quelconque — la route doit
 * le repasser dans `parseBottleDetails(bottle.category, ...)` avant
 * d'appeler `updateBottle`, pour valider sa forme selon la catégorie de la
 * bouteille (immuable, donc absente de ce schéma).
 */
export const updateBottleBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    producer: z.string().nullable().optional(),
    vintage: z.number().int().nullable().optional(),
    region: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    abv: z.number().nullable().optional(),
    volumeMl: z.number().int().nullable().optional(),
    quantity: z.number().int().min(0).optional(),
    userNote: z.string().nullable().optional(),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    drinkFrom: z.number().int().nullable().optional(),
    drinkUntil: z.number().int().nullable().optional(),
    crateId: z.string().min(1).optional(),
    details: z.unknown().optional(),
  })
  .strict();

export const updateBottle = async (db: Db, bottleId: string, input: UpdateBottleInput): Promise<void> => {
  if (input.crateId) {
    // Une bouteille déplacée vers une autre clayette est ajoutée à la fin
    // de celle-ci — son ancien sortOrder n'a aucun sens dans ce nouveau
    // contexte et pourrait entrer en collision avec un ordre déjà existant.
    const siblingCount = (
      await db.select({ id: bottles.id }).from(bottles).where(eq(bottles.crateId, input.crateId))
    ).length;
    await db
      .update(bottles)
      .set({ ...input, sortOrder: siblingCount })
      .where(eq(bottles.id, bottleId));
    return;
  }
  await db.update(bottles).set(input).where(eq(bottles.id, bottleId));
};

/**
 * Réordonne les bouteilles actives (quantité > 0) d'une clayette. `orderedIds`
 * doit correspondre exactement à l'ensemble des bouteilles actives de cette
 * clayette — même garde-fou que `reorderCrates`, pour éviter qu'une liste
 * incomplète ou d'une autre clayette ne corrompe le tri.
 */
export const reorderBottlesInCrate = async (db: Db, crateId: string, orderedIds: string[]): Promise<void> => {
  const existing = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(and(eq(bottles.crateId, crateId), gt(bottles.quantity, 0)));
  const existingIds = new Set(existing.map((b) => b.id));
  const sameSet = orderedIds.length === existing.length && orderedIds.every((id) => existingIds.has(id));
  if (!sameSet) {
    throw new Error(
      'La liste fournie ne correspond pas exactement aux bouteilles actives de cette clayette.',
    );
  }

  for (const [index, bottleId] of orderedIds.entries()) {
    await db.update(bottles).set({ sortOrder: index }).where(eq(bottles.id, bottleId));
  }
};

export const deleteBottle = async (db: Db, bottleId: string): Promise<void> => {
  await db.delete(bottles).where(eq(bottles.id, bottleId));
};
