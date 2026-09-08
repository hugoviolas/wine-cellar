import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { wishlistItems } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails, type BottleCategory } from './bottleCategories';

export interface CreateWishlistItemInput {
  userId: string;
  category: BottleCategory;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  color?: string;
  abv?: number;
  volumeMl?: number;
  details: unknown;
}

export async function createWishlistItem(db: Db, input: CreateWishlistItemInput): Promise<string> {
  const details = parseBottleDetails(input.category, input.details);
  const id = newId();
  await db.insert(wishlistItems).values({
    id,
    userId: input.userId,
    category: input.category,
    name: input.name,
    producer: input.producer ?? null,
    vintage: input.vintage ?? null,
    region: input.region ?? null,
    color: input.color ?? null,
    abv: input.abv ?? null,
    volumeMl: input.volumeMl ?? null,
    details,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listWishlistItems(db: Db, userId: string) {
  return db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt), desc(wishlistItems.name));
}

export async function getWishlistItem(db: Db, id: string) {
  const [row] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).limit(1);
  return row ?? null;
}

export type WishlistItemAccessResult =
  | { status: 'ok'; item: NonNullable<Awaited<ReturnType<typeof getWishlistItem>>> }
  | { status: 'not_found' }
  | { status: 'forbidden' };

/**
 * Accès strictement privé : seul item.userId === userId passe, aucun
 * bypass super-admin (contrairement à checkCellarAccess) — la wishlist est
 * une donnée personnelle, pas une ressource de cave.
 */
export async function resolveWishlistItemAccess(
  db: Db,
  userId: string,
  itemId: string,
): Promise<WishlistItemAccessResult> {
  const item = await getWishlistItem(db, itemId);
  if (!item) return { status: 'not_found' };
  if (item.userId !== userId) return { status: 'forbidden' };
  return { status: 'ok', item };
}

export interface UpdateWishlistItemInput {
  name?: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  color?: string | null;
  abv?: number | null;
  volumeMl?: number | null;
  details?: unknown;
}

/** category absente : immuable après création, comme sur bottles. */
export const updateWishlistItemBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    producer: z.string().nullable().optional(),
    vintage: z.number().int().nullable().optional(),
    region: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    abv: z.number().nullable().optional(),
    volumeMl: z.number().int().nullable().optional(),
    details: z.unknown().optional(),
  })
  .strict();

export async function updateWishlistItem(db: Db, id: string, input: UpdateWishlistItemInput): Promise<void> {
  await db.update(wishlistItems).set(input).where(eq(wishlistItems.id, id));
}

export async function deleteWishlistItem(db: Db, id: string): Promise<void> {
  await db.delete(wishlistItems).where(eq(wishlistItems.id, id));
}
