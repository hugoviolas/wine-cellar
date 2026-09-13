import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { wishlistItems } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails, type BottleCategory } from './bottleCategories';
import { createBottle } from './bottles';
import { listCrates } from './crates';
import { canEditCellarContent } from './permissions';
import type { CellarRole } from './access';
import { users, cellars, cellarMemberships } from '../db/schema';

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
  comment?: string;
}

export const createWishlistItemBodySchema = z
  .object({
    category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']),
    name: z.string().min(1),
    producer: z.string().optional(),
    vintage: z.number().int().optional(),
    region: z.string().optional(),
    color: z.string().optional(),
    abv: z.number().optional(),
    volumeMl: z.number().int().optional(),
    details: z.unknown(),
    comment: z.string().max(2000).optional(),
  })
  .strict();

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
    // Chaîne vide traitée comme absence de commentaire, comme partout
    // ailleurs dans l'app (voir renameCrate, updateCellarInfo).
    comment: input.comment?.trim() || null,
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
  comment?: string | null;
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
    comment: z.string().max(2000).nullable().optional(),
  })
  .strict();

export async function updateWishlistItem(db: Db, id: string, input: UpdateWishlistItemInput): Promise<void> {
  await db.update(wishlistItems).set(input).where(eq(wishlistItems.id, id));
}

export async function deleteWishlistItem(db: Db, id: string): Promise<void> {
  await db.delete(wishlistItems).where(eq(wishlistItems.id, id));
}

export const promoteWishlistItemBodySchema = z
  .object({
    crateId: z.string().min(1),
    quantity: z.number().int().min(1),
  })
  .strict();

type WishlistItemRow = NonNullable<Awaited<ReturnType<typeof getWishlistItem>>>;

/**
 * item.status doit être 'pending' (vérifié ici en défense, la route l'a
 * déjà vérifié avant l'appel). Construit une vraie bouteille à partir des
 * champs capturés dans l'item, via createBottle (inchangé) — c'est ce qui
 * fait qu'une fois promue, la bouteille bénéficie du flux IA existant sans
 * rien de spécifique à écrire ici.
 */
export async function promoteWishlistItem(
  db: Db,
  item: WishlistItemRow,
  input: { crateId: string; quantity: number },
): Promise<{ bottleId: string }> {
  if (item.status !== 'pending') {
    throw new Error('Cet item a déjà été ajouté à une cave.');
  }

  const bottleId = await createBottle(db, {
    crateId: input.crateId,
    category: item.category as BottleCategory,
    name: item.name,
    producer: item.producer ?? undefined,
    vintage: item.vintage ?? undefined,
    region: item.region ?? undefined,
    color: item.color ?? undefined,
    abv: item.abv ?? undefined,
    volumeMl: item.volumeMl ?? undefined,
    quantity: input.quantity,
    details: item.details,
    // Le commentaire de l'item devient la note de la bouteille : sans ça
    // il resterait visible seulement dans la wishlist, alors que c'est sur
    // la fiche bouteille qu'on le relira. L'item le conserve de son côté.
    userNote: item.comment ?? undefined,
    // L'analyse et la fenêtre de garde suivent aussi : elles ont été
    // produites sur cette bouteille-là, les régénérer coûterait un appel
    // pour un résultat équivalent. La régénération reste possible depuis
    // la fiche si le millésime ou la région ont été corrigés entre-temps.
    drinkFrom: item.drinkFrom ?? undefined,
    drinkUntil: item.drinkUntil ?? undefined,
    aiAnalysis: item.aiAnalysis,
    aiPairings: item.aiPairings,
    aiTastingAdvice: item.aiTastingAdvice,
    aiGeneratedAt: item.aiGeneratedAt,
  });

  await db
    .update(wishlistItems)
    .set({ status: 'promoted', promotedBottleId: bottleId })
    .where(eq(wishlistItems.id, item.id));

  return { bottleId };
}

export interface PromotionTarget {
  cellarId: string;
  cellarName: string;
  crates: { id: string; number: number; name: string | null; capacity: number }[];
}

/**
 * Caves où l'utilisateur peut ajouter du contenu — un super-admin voit
 * toutes les caves (même logique que checkCellarAccess côté droits), un
 * utilisateur normal seulement celles où sa cellar_membership a un rôle
 * owner/editor (canEditCellarContent).
 */
export async function listPromotionTargets(db: Db, userId: string): Promise<PromotionTarget[]> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  let editableCellars: (typeof cellars.$inferSelect)[];
  if (user?.isSuperAdmin) {
    editableCellars = await db.select().from(cellars);
  } else {
    const rows = await db
      .select({ cellar: cellars, role: cellarMemberships.role })
      .from(cellarMemberships)
      .innerJoin(cellars, eq(cellarMemberships.cellarId, cellars.id))
      .where(eq(cellarMemberships.userId, userId));
    editableCellars = rows.filter((r) => canEditCellarContent(r.role as CellarRole)).map((r) => r.cellar);
  }

  const targets: PromotionTarget[] = [];
  for (const cellar of editableCellars) {
    const crateRows = await listCrates(db, cellar.id);
    targets.push({
      cellarId: cellar.id,
      cellarName: cellar.name,
      crates: crateRows.map((c) => ({ id: c.id, number: c.number, name: c.name, capacity: c.capacity })),
    });
  }
  return targets;
}
