import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bottles, crates, consumptionHistory } from '../db/schema';
import { newId } from '../db/id';

export class BottleUnavailableError extends Error {}

export interface ConsumeBottleInput {
  bottleId: string;
  consumedByUserId: string;
  consumedAt: string;
  quantity?: number;
  rating?: number;
  comment?: string;
  occasion?: string;
}

async function getCellarIdForCrate(db: Db, crateId: string): Promise<string> {
  const [crate] = await db.select().from(crates).where(eq(crates.id, crateId)).limit(1);
  if (!crate) throw new Error('Clayette introuvable');
  return crate.cellarId;
}

export async function consumeBottle(db: Db, input: ConsumeBottleInput): Promise<string> {
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new BottleUnavailableError('Quantité invalide');
  }

  const [bottle] = await db.select().from(bottles).where(eq(bottles.id, input.bottleId)).limit(1);
  if (!bottle || bottle.quantity < quantity) {
    throw new BottleUnavailableError('Quantité demandée supérieure au stock disponible');
  }

  await db.update(bottles).set({ quantity: bottle.quantity - quantity }).where(eq(bottles.id, bottle.id));

  // Une bouteille avec quantité ≥ 1 appartient forcément encore à une
  // clayette vivante : la suppression d'une clayette est bloquée tant
  // qu'elle contient des bouteilles en stock (voir crateHasActiveBottles).
  if (!bottle.crateId) {
    throw new Error('Bouteille orpheline : sa clayette a été supprimée.');
  }
  const cellarId = await getCellarIdForCrate(db, bottle.crateId);
  const historyId = newId();
  await db.insert(consumptionHistory).values({
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

  return historyId;
}
