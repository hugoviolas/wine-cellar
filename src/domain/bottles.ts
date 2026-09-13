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
  /**
   * Note personnelle posée dès la création. Volontairement absente de
   * `createBottleBodySchema` : le formulaire d'ajout ne la propose pas
   * (elle s'édite ensuite depuis la fiche). Sert à la promotion d'un item
   * de wishlist, qui y reverse son commentaire.
   */
  userNote?: string;
  /**
   * Analyse IA déjà produite, reprise telle quelle. Même raison que
   * `userNote` : absente de `createBottleBodySchema`, elle ne sert qu'à la
   * promotion d'un item de wishlist déjà analysé, pour éviter de repayer
   * un appel sur la bouteille créée.
   */
  aiAnalysis?: string | null;
  aiPairings?: unknown;
  aiTastingAdvice?: string | null;
  aiGeneratedAt?: string | null;
}

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

export async function createBottle(db: Db, input: CreateBottleInput): Promise<string> {
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
}

export async function listBottlesByCellar(db: Db, cellarId: string) {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(eq(crates.cellarId, cellarId))
    .orderBy(bottles.sortOrder);
}

export async function listActiveBottlesByCellar(db: Db, cellarId: string) {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(and(eq(crates.cellarId, cellarId), gt(bottles.quantity, 0)))
    .orderBy(bottles.sortOrder);
}

export async function getBottle(db: Db, bottleId: string) {
  const [row] = await db.select().from(bottles).where(eq(bottles.id, bottleId)).limit(1);
  return row ?? null;
}

export interface UpdateBottleInput {
  name?: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  color?: string | null;
  abv?: number | null;
  volumeMl?: number | null;
  quantity?: number;
  userNote?: string | null;
  rating?: number | null;
  drinkFrom?: number | null;
  drinkUntil?: number | null;
  crateId?: string;
  details?: unknown;
}

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

export async function updateBottle(db: Db, bottleId: string, input: UpdateBottleInput): Promise<void> {
  if (input.crateId) {
    // Une bouteille déplacée vers une autre clayette est ajoutée à la fin
    // de celle-ci — son ancien sortOrder n'a aucun sens dans ce nouveau
    // contexte et pourrait entrer en collision avec un ordre déjà existant.
    const siblingCount = (
      await db.select({ id: bottles.id }).from(bottles).where(eq(bottles.crateId, input.crateId))
    ).length;
    await db.update(bottles).set({ ...input, sortOrder: siblingCount }).where(eq(bottles.id, bottleId));
    return;
  }
  await db.update(bottles).set(input).where(eq(bottles.id, bottleId));
}

/**
 * Réordonne les bouteilles actives (quantité > 0) d'une clayette. `orderedIds`
 * doit correspondre exactement à l'ensemble des bouteilles actives de cette
 * clayette — même garde-fou que `reorderCrates`, pour éviter qu'une liste
 * incomplète ou d'une autre clayette ne corrompe le tri.
 */
export async function reorderBottlesInCrate(db: Db, crateId: string, orderedIds: string[]): Promise<void> {
  const existing = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(and(eq(bottles.crateId, crateId), gt(bottles.quantity, 0)));
  const existingIds = new Set(existing.map((b) => b.id));
  const sameSet = orderedIds.length === existing.length && orderedIds.every((id) => existingIds.has(id));
  if (!sameSet) {
    throw new Error('La liste fournie ne correspond pas exactement aux bouteilles actives de cette clayette.');
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(bottles).set({ sortOrder: i }).where(eq(bottles.id, orderedIds[i]));
  }
}

export async function deleteBottle(db: Db, bottleId: string): Promise<void> {
  await db.delete(bottles).where(eq(bottles.id, bottleId));
}
