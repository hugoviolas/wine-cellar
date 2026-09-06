import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bottles, crates, consumptionHistory } from '../db/schema';
import { newId } from '../db/id';

export class BottleUnavailableError extends Error {}

export interface ConsumeBottleInput {
  bottleId: string;
  consumedByUserId: string;
  consumedAt: string;
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
  const [bottle] = await db.select().from(bottles).where(eq(bottles.id, input.bottleId)).limit(1);
  if (!bottle || bottle.quantity < 1) {
    throw new BottleUnavailableError('Aucune bouteille disponible à consommer');
  }

  await db.update(bottles).set({ quantity: bottle.quantity - 1 }).where(eq(bottles.id, bottle.id));

  const cellarId = await getCellarIdForCrate(db, bottle.crateId);
  const historyId = newId();
  await db.insert(consumptionHistory).values({
    id: historyId,
    bottleId: bottle.id,
    cellarId,
    consumedByUserId: input.consumedByUserId,
    consumedAt: input.consumedAt,
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
