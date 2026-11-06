import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import { bottles, crates } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails, getAppellation } from './bottleCategories';
import { resolveWineGeography } from './wineGeography';
import type { BottleRow } from '../db/rows';
import type { BottleWithCrate } from './interfaces/bottle-with-crate.interface';
import type { CreateBottleInput } from './interfaces/create-bottle-input.interface';
import type { UpdateBottleInput } from './interfaces/update-bottle-input.interface';
import { FIELD_MAX } from './fieldLimits';
import type { CreateBottleArgs } from './interfaces/create-bottle-args.interface';
import type { ListBottlesByCellarArgs } from './interfaces/list-bottles-by-cellar-args.interface';
import type { ListActiveBottlesByCellarArgs } from './interfaces/list-active-bottles-by-cellar-args.interface';
import type { GetBottleArgs } from './interfaces/get-bottle-args.interface';
import type { UpdateBottleArgs } from './interfaces/update-bottle-args.interface';
import type { ReorderBottlesInCrateArgs } from './interfaces/reorder-bottles-in-crate-args.interface';
import type { DeleteBottleArgs } from './interfaces/delete-bottle-args.interface';
import type { MoveBottlesArgs } from './interfaces/move-bottles-args.interface';

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
    name: z.string().min(1).max(FIELD_MAX.shortText),
    producer: z.string().max(FIELD_MAX.shortText).optional(),
    vintage: z.number().int().optional(),
    region: z.string().max(FIELD_MAX.shortText).optional(),
    subRegion: z.string().max(FIELD_MAX.shortText).optional(),
    color: z.string().max(FIELD_MAX.shortText).optional(),
    abv: z.number().nonnegative().optional(),
    volumeMl: z.number().int().positive().optional(),
    quantity: z.number().int().min(0),
    drinkFrom: z.number().int().optional(),
    drinkUntil: z.number().int().optional(),
    details: z.unknown(),
  })
  .strict();

export const createBottle = async ({ db, input }: CreateBottleArgs): Promise<string> => {
  const details = parseBottleDetails(input.category, input.details);
  const geography = resolveWineGeography({
    region: input.region,
    subRegion: input.subRegion,
    appellation: getAppellation({ category: input.category, details }),
  });
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
    region: geography.region,
    subRegion: geography.subRegion,
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

export const listBottlesByCellar = async ({
  db,
  cellarId,
}: ListBottlesByCellarArgs): Promise<BottleWithCrate[]> => {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(eq(crates.cellarId, cellarId))
    .orderBy(bottles.sortOrder);
};

export const listActiveBottlesByCellar = async ({
  db,
  cellarId,
}: ListActiveBottlesByCellarArgs): Promise<BottleWithCrate[]> => {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(and(eq(crates.cellarId, cellarId), gt(bottles.quantity, 0)))
    .orderBy(bottles.sortOrder);
};

export const getBottle = async ({ db, bottleId }: GetBottleArgs): Promise<BottleRow | null> => {
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
    name: z.string().min(1).max(FIELD_MAX.shortText).optional(),
    producer: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    vintage: z.number().int().nullable().optional(),
    region: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    subRegion: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    color: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    abv: z.number().nullable().optional(),
    volumeMl: z.number().int().nullable().optional(),
    quantity: z.number().int().min(0).optional(),
    userNote: z.string().max(FIELD_MAX.longText).nullable().optional(),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    drinkFrom: z.number().int().nullable().optional(),
    drinkUntil: z.number().int().nullable().optional(),
    crateId: z.string().min(1).optional(),
    details: z.unknown().optional(),
  })
  .strict();

/**
 * Patch enrichi de la région et de la sous-région canoniques.
 *
 * Le calcul doit porter sur l'état *après* application du patch, pas sur le
 * patch seul : changer la seule appellation doit pouvoir recaler la région,
 * et changer la seule région doit rester cohérent avec l'appellation déjà
 * stockée. D'où la relecture de la ligne courante dès que l'un des trois
 * champs concernés bouge.
 */
const withResolvedGeography = async ({
  db,
  bottleId,
  input,
}: UpdateBottleArgs): Promise<UpdateBottleInput> => {
  const touchesGeography = 'region' in input || 'subRegion' in input || 'details' in input;
  if (!touchesGeography) {
    return input;
  }
  const current = await getBottle({ db, bottleId });
  if (!current) {
    return input;
  }
  const details = 'details' in input ? input.details : current.details;
  const geography = resolveWineGeography({
    region: 'region' in input ? input.region : current.region,
    subRegion: 'subRegion' in input ? input.subRegion : current.subRegion,
    appellation: getAppellation({ category: current.category, details }),
  });
  return { ...input, region: geography.region, subRegion: geography.subRegion };
};

export const updateBottle = async ({ db, bottleId, input: rawInput }: UpdateBottleArgs): Promise<void> => {
  const input = await withResolvedGeography({ db, bottleId, input: rawInput });
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

export type BottleMoveFailure =
  | 'bottle_not_found'
  | 'crate_not_found'
  | 'other_cellar'
  | 'same_crate'
  | 'invalid_quantity'
  | 'insufficient_stock';

export class BottleMoveError extends Error {
  readonly reason: BottleMoveFailure;

  constructor(reason: BottleMoveFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Corps attendu par `POST /api/bottles/[id]/move`. `quantity` absent =
 * tout le stock ; sa borne haute (le stock réel) n'est vérifiable qu'en
 * base, dans `moveBottles`.
 */
export const moveBottlesBodySchema = z
  .object({
    crateId: z.string().min(1),
    quantity: z.number().int().min(1).optional(),
  })
  .strict();

/**
 * Déplace tout ou partie du stock d'une bouteille vers une autre clayette
 * de la même cave, et renvoie l'identifiant de la ligne qui se trouve
 * désormais dans la clayette cible.
 *
 * - Tout le stock : la ligne elle-même change de clayette, avec son
 *   historique de consommation.
 * - Une partie : la ligne est scindée. Le reste ne bouge pas et garde
 *   l'historique ; les bouteilles déplacées deviennent une nouvelle ligne,
 *   copie de la fiche (identité, garde, analyse IA, note, date d'entrée en
 *   cave), ajoutée en fin de clayette cible.
 *
 * Pas de fusion avec une ligne « identique » déjà présente dans la clayette
 * cible : deux lignes du même vin peuvent avoir divergé (note, analyse,
 * historique), et les fondre ferait perdre l'une des deux sans le dire.
 *
 * Lecture et écritures dans une même transaction : le stock vérifié est
 * celui qui est décrémenté, même si une consommation tombe entre-temps.
 */
export const moveBottles = async ({
  db,
  bottleId,
  toCrateId,
  quantity,
}: MoveBottlesArgs): Promise<string> => {
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
    throw new BottleMoveError('invalid_quantity', 'Le nombre de bouteilles à déplacer doit être au moins 1.');
  }

  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(bottles).where(eq(bottles.id, bottleId)).limit(1);
    if (!source) {
      throw new BottleMoveError('bottle_not_found', 'Bouteille introuvable.');
    }
    const [targetCrate] = await tx.select().from(crates).where(eq(crates.id, toCrateId)).limit(1);
    if (!targetCrate) {
      throw new BottleMoveError('crate_not_found', 'Clayette de destination introuvable.');
    }
    const [sourceCrate] = source.crateId
      ? await tx.select().from(crates).where(eq(crates.id, source.crateId)).limit(1)
      : [];
    // Même garde-fou que `PATCH /api/bottles/[id]` : sans lui, le
    // déplacement redevient un moyen de faire passer une bouteille dans une
    // cave où l'on n'a aucun droit.
    if (!sourceCrate || sourceCrate.cellarId !== targetCrate.cellarId) {
      throw new BottleMoveError('other_cellar', 'La clayette de destination doit appartenir à la même cave.');
    }
    if (sourceCrate.id === targetCrate.id) {
      throw new BottleMoveError('same_crate', 'Cette bouteille est déjà dans cette clayette.');
    }

    const movedQuantity = quantity ?? source.quantity;
    if (movedQuantity > source.quantity) {
      throw new BottleMoveError(
        'insufficient_stock',
        'Nombre de bouteilles à déplacer supérieur au stock disponible.',
      );
    }

    const sortOrder = (
      await tx.select({ id: bottles.id }).from(bottles).where(eq(bottles.crateId, toCrateId))
    ).length;

    if (movedQuantity === source.quantity) {
      await tx.update(bottles).set({ crateId: toCrateId, sortOrder }).where(eq(bottles.id, source.id));
      return source.id;
    }

    const movedId = newId();
    await tx
      .update(bottles)
      .set({ quantity: source.quantity - movedQuantity })
      .where(eq(bottles.id, source.id));
    await tx.insert(bottles).values({
      ...source,
      id: movedId,
      crateId: toCrateId,
      sortOrder,
      quantity: movedQuantity,
    });
    return movedId;
  });
};

/**
 * Réordonne les bouteilles actives (quantité > 0) d'une clayette. `orderedIds`
 * doit correspondre exactement à l'ensemble des bouteilles actives de cette
 * clayette — même garde-fou que `reorderCrates`, pour éviter qu'une liste
 * incomplète ou d'une autre clayette ne corrompe le tri.
 */
export const reorderBottlesInCrate = async ({
  db,
  crateId,
  orderedIds,
}: ReorderBottlesInCrateArgs): Promise<void> => {
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

export const deleteBottle = async ({ db, bottleId }: DeleteBottleArgs): Promise<void> => {
  await db.delete(bottles).where(eq(bottles.id, bottleId));
};
