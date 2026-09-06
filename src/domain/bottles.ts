import { eq, and, gt } from 'drizzle-orm';
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
