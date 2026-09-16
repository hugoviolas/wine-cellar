import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, DbOrTx } from '../db/client';
import { bottles, crates, consumptionHistory } from '../db/schema';
import { newId } from '../db/id';
import type { ConsumeBottleInput } from './interfaces/consume-bottle-input.interface';
import { FIELD_MAX } from './fieldLimits';

export type { ConsumeBottleInput };

export class BottleUnavailableError extends Error {}

/**
 * Corps attendu par `POST /api/bottles/[id]/consume`. Tous les champs sont
 * optionnels (la route applique ses propres valeurs par défaut), mais leur
 * type ne l'est pas : sans ce schéma, `rating`, `comment` et `occasion`
 * partaient bruts en base, où SQLite acceptait n'importe quel type.
 * `quantity` est aussi revérifié dans `consumeBottle`, qui reste appelable
 * hors route.
 */
export const consumeBottleBodySchema = z
  .object({
    consumedAt: z.string().min(1).max(FIELD_MAX.shortText).optional(),
    quantity: z.number().int().min(1).optional(),
    rating: z.number().int().min(0).max(5).optional(),
    comment: z.string().max(FIELD_MAX.longText).optional(),
    occasion: z.string().max(FIELD_MAX.shortText).optional(),
  })
  .strict();

const getCellarIdForCrate = async (db: DbOrTx, crateId: string): Promise<string> => {
  const [crate] = await db.select().from(crates).where(eq(crates.id, crateId)).limit(1);
  if (!crate) {
    throw new Error('Clayette introuvable');
  }
  return crate.cellarId;
};

export const consumeBottle = async (db: Db, input: ConsumeBottleInput): Promise<string> => {
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new BottleUnavailableError('Quantité invalide');
  }

  const [bottle] = await db.select().from(bottles).where(eq(bottles.id, input.bottleId)).limit(1);
  if (!bottle || bottle.quantity < quantity) {
    throw new BottleUnavailableError('Quantité demandée supérieure au stock disponible');
  }

  // Une bouteille avec quantité ≥ 1 appartient forcément encore à une
  // clayette vivante : la suppression d'une clayette est bloquée tant
  // qu'elle contient des bouteilles en stock (voir crateHasActiveBottles).
  if (!bottle.crateId) {
    throw new Error('Bouteille orpheline : sa clayette a été supprimée.');
  }
  const crateId = bottle.crateId;
  const historyId = newId();

  // Décrément du stock et écriture de l'historique dans la même
  // transaction : séparés, un échec entre les deux faisait disparaître une
  // bouteille du stock sans trace de sa consommation, ou l'inverse.
  await db.transaction(async (tx) => {
    await tx
      .update(bottles)
      .set({ quantity: bottle.quantity - quantity })
      .where(eq(bottles.id, bottle.id));

    const cellarId = await getCellarIdForCrate(tx, crateId);
    await tx.insert(consumptionHistory).values({
      id: historyId,
      bottleId: bottle.id,
      cellarId,
      consumedByUserId: input.consumedByUserId,
      consumedAt: input.consumedAt,
      quantity,
      rating: input.rating ?? null,
      comment: input.comment ?? null,
      occasion: input.occasion ?? null,
      bottleNameSnapshot: bottle.name,
      bottleProducerSnapshot: bottle.producer,
      bottleVintageSnapshot: bottle.vintage,
      bottleCategorySnapshot: bottle.category,
    });
  });

  return historyId;
};
