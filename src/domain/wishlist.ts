import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { wishlistItems } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails } from './bottleCategories';
import { createBottle } from './bottles';
import { listCrates } from './crates';
import { canEditCellarContent } from './permissions';
import type { WishlistItemRow } from '../db/rows';
import { users, cellars, cellarMemberships } from '../db/schema';
import type { CreateWishlistItemInput } from './interfaces/create-wishlist-item-input.interface';
import type { PromotionTarget } from './interfaces/promotion-target.interface';
import type { UpdateWishlistItemInput } from './interfaces/update-wishlist-item-input.interface';
import { FIELD_MAX } from './fieldLimits';
import type { CreateWishlistItemArgs } from './interfaces/create-wishlist-item-args.interface';
import type { ListWishlistItemsArgs } from './interfaces/list-wishlist-items-args.interface';
import type { GetWishlistItemArgs } from './interfaces/get-wishlist-item-args.interface';
import type { ResolveWishlistItemAccessArgs } from './interfaces/resolve-wishlist-item-access-args.interface';
import type { UpdateWishlistItemArgs } from './interfaces/update-wishlist-item-args.interface';
import type { DeleteWishlistItemArgs } from './interfaces/delete-wishlist-item-args.interface';
import type { PromoteWishlistItemArgs } from './interfaces/promote-wishlist-item-args.interface';
import type { ListPromotionTargetsArgs } from './interfaces/list-promotion-targets-args.interface';

export type { CreateWishlistItemInput, PromotionTarget, UpdateWishlistItemInput };

export const createWishlistItemBodySchema = z
  .object({
    category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']),
    name: z.string().min(1).max(FIELD_MAX.shortText),
    producer: z.string().max(FIELD_MAX.shortText).optional(),
    vintage: z.number().int().optional(),
    region: z.string().max(FIELD_MAX.shortText).optional(),
    color: z.string().max(FIELD_MAX.shortText).optional(),
    abv: z.number().optional(),
    volumeMl: z.number().int().optional(),
    details: z.unknown(),
    comment: z.string().max(FIELD_MAX.longText).optional(),
  })
  .strict();

export const createWishlistItem = async ({ db, input }: CreateWishlistItemArgs): Promise<string> => {
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
};

export const listWishlistItems = async ({
  db,
  userId,
}: ListWishlistItemsArgs): Promise<WishlistItemRow[]> => {
  return db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt), desc(wishlistItems.name));
};

export const getWishlistItem = async ({ db, id }: GetWishlistItemArgs): Promise<WishlistItemRow | null> => {
  const [row] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).limit(1);
  return row ?? null;
};

export type WishlistItemAccessResult =
  | { status: 'ok'; item: NonNullable<Awaited<ReturnType<typeof getWishlistItem>>> }
  | { status: 'not_found' }
  | { status: 'forbidden' };

/**
 * Accès strictement privé : seul item.userId === userId passe, aucun
 * bypass super-admin (contrairement à checkCellarAccess) — la wishlist est
 * une donnée personnelle, pas une ressource de cave.
 */
export const resolveWishlistItemAccess = async ({
  db,
  userId,
  itemId,
}: ResolveWishlistItemAccessArgs): Promise<WishlistItemAccessResult> => {
  const item = await getWishlistItem({ db, id: itemId });
  if (!item) {
    return { status: 'not_found' };
  }
  if (item.userId !== userId) {
    return { status: 'forbidden' };
  }
  return { status: 'ok', item };
};

/** category absente : immuable après création, comme sur bottles. */
export const updateWishlistItemBodySchema = z
  .object({
    name: z.string().min(1).max(FIELD_MAX.shortText).optional(),
    producer: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    vintage: z.number().int().nullable().optional(),
    region: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    color: z.string().max(FIELD_MAX.shortText).nullable().optional(),
    abv: z.number().nullable().optional(),
    volumeMl: z.number().int().nullable().optional(),
    details: z.unknown().optional(),
    comment: z.string().max(FIELD_MAX.longText).nullable().optional(),
  })
  .strict();

export const updateWishlistItem = async ({ db, id, input }: UpdateWishlistItemArgs): Promise<void> => {
  await db.update(wishlistItems).set(input).where(eq(wishlistItems.id, id));
};

export const deleteWishlistItem = async ({ db, id }: DeleteWishlistItemArgs): Promise<void> => {
  await db.delete(wishlistItems).where(eq(wishlistItems.id, id));
};

export const promoteWishlistItemBodySchema = z
  .object({
    crateId: z.string().min(1),
    quantity: z.number().int().min(1),
  })
  .strict();

/**
 * item.status doit être 'pending' (vérifié ici en défense, la route l'a
 * déjà vérifié avant l'appel). Construit une vraie bouteille à partir des
 * champs capturés dans l'item, via createBottle (inchangé) — c'est ce qui
 * fait qu'une fois promue, la bouteille bénéficie du flux IA existant sans
 * rien de spécifique à écrire ici.
 */
export const promoteWishlistItem = async ({
  db,
  item,
  input,
}: PromoteWishlistItemArgs): Promise<{ bottleId: string }> => {
  if (item.status !== 'pending') {
    throw new Error('Cet item a déjà été ajouté à une cave.');
  }

  // Création de la bouteille et marquage de l'item dans la même
  // transaction : séparés, un échec entre les deux laissait un item encore
  // « à acheter » alors que la bouteille était déjà en cave, ou un item
  // promu pointant vers une bouteille inexistante.
  return db.transaction(async (tx) => {
    const bottleId = await createBottle({
      db: tx,
      input: {
        crateId: input.crateId,
        category: item.category,
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
      },
    });

    await tx
      .update(wishlistItems)
      .set({ status: 'promoted', promotedBottleId: bottleId })
      .where(eq(wishlistItems.id, item.id));

    return { bottleId };
  });
};

/**
 * Caves où l'utilisateur peut ajouter du contenu — un super-admin voit
 * toutes les caves (même logique que checkCellarAccess côté droits), un
 * utilisateur normal seulement celles où sa cellar_membership a un rôle
 * owner/editor (canEditCellarContent).
 */
export const listPromotionTargets = async ({
  db,
  userId,
}: ListPromotionTargetsArgs): Promise<PromotionTarget[]> => {
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
    editableCellars = rows.filter((r) => canEditCellarContent(r.role)).map((r) => r.cellar);
  }

  const targets: PromotionTarget[] = [];
  for (const cellar of editableCellars) {
    const crateRows = await listCrates({ db, cellarId: cellar.id });
    targets.push({
      cellarId: cellar.id,
      cellarName: cellar.name,
      crates: crateRows.map((c) => ({ id: c.id, number: c.number, name: c.name, capacity: c.capacity })),
    });
  }
  return targets;
};
