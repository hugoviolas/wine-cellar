import { z } from 'zod';
import {
  createWishlistItem,
  deleteWishlistItem,
  listWishlistItems,
  promoteWishlistItem,
  updateWishlistItem,
} from '@/domain/wishlist';
import { parisYear } from '@/domain/parisDate';
import { requireEditor, resolveBottle, resolveCrate, resolveWishlistItem } from './access';
import { buildDetails, checkColor } from './details';
import { buildWishlistPatch } from './patches';
import { presentBottleDetail, presentWishlistItem } from './presenters';
import {
  bottleDescriptionFields,
  categoryField,
  clearable,
  commentField,
  crateIdField,
  wishlistItemIdField,
} from './schemas';
import { ToolError, runTool } from './toolResult';
import type { RegisterToolsArgs } from './interfaces/register-tools-args.interface';
import type { WishlistItemView } from './interfaces/wishlist-item-view.interface';
import type { ResolveByIdArgs } from './interfaces/resolve-by-id-args.interface';

const WISHLIST_NOTE =
  "La wishlist est personnelle : elle n'appartient à aucune cave et personne d'autre ne la voit.";

/** Item relu après une écriture. */
const reloadItem = async ({ context, id }: ResolveByIdArgs): Promise<WishlistItemView> => {
  return presentWishlistItem(await resolveWishlistItem({ context, id }));
};

export const registerWishlistTools = ({ server, context }: RegisterToolsArgs): void => {
  const { db, user } = context;

  server.registerTool(
    'list_wishlist',
    {
      title: 'Lister la wishlist',
      description: `Bouteilles que l'utilisateur veut acheter ou goûter, les plus récentes d'abord. status : pending (à acheter), promoted (déjà achetée et rangée en cave, promoted_bottle_id). ${WISHLIST_NOTE}`,
      inputSchema: {
        status: z
          .enum(['pending', 'promoted', 'all'])
          .optional()
          .describe('pending (par défaut), promoted ou all.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ status }) => {
      return runTool({
        tool: 'list_wishlist',
        work: async () => {
          const wanted = status ?? 'pending';
          const items = (await listWishlistItems({ db, userId: user.id })).filter(
            (item) => wanted === 'all' || item.status === wanted,
          );
          return { total: items.length, items: items.map(presentWishlistItem) };
        },
      });
    },
  );

  server.registerTool(
    'add_wishlist_item',
    {
      title: 'Ajouter à la wishlist',
      description: `Ajoute une bouteille à la wishlist (une envie, une recommandation, un vin goûté ailleurs). ${WISHLIST_NOTE} Renvoie l'item créé.`,
      inputSchema: {
        category: categoryField,
        ...bottleDescriptionFields,
        producer: bottleDescriptionFields.producer.optional(),
        vintage: bottleDescriptionFields.vintage.optional(),
        region: bottleDescriptionFields.region.optional(),
        sub_region: bottleDescriptionFields.sub_region.optional(),
        color: bottleDescriptionFields.color.optional(),
        abv: bottleDescriptionFields.abv.optional(),
        volume_ml: bottleDescriptionFields.volume_ml.optional(),
        appellation: bottleDescriptionFields.appellation.optional(),
        classification: bottleDescriptionFields.classification.optional(),
        grape_varieties: bottleDescriptionFields.grape_varieties.optional(),
        comment: commentField
          .optional()
          .describe('Pourquoi cette bouteille : recommandation, prix vu chez un caviste, plat prévu…'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'add_wishlist_item',
        work: async () => {
          checkColor({ category: input.category, color: input.color });
          const itemId = await createWishlistItem({
            db,
            input: {
              userId: user.id,
              category: input.category,
              name: input.name,
              producer: input.producer,
              vintage: input.vintage,
              region: input.region,
              subRegion: input.sub_region,
              color: input.color,
              abv: input.abv,
              volumeMl: input.volume_ml,
              comment: input.comment,
              details: buildDetails({ category: input.category, current: {}, input }),
            },
          });
          return reloadItem({ context, id: itemId });
        },
      });
    },
  );

  server.registerTool(
    'update_wishlist_item',
    {
      title: 'Modifier un item de wishlist',
      description:
        'Modifie un item de la wishlist. Seuls les champs fournis changent ; null efface un champ facultatif.',
      inputSchema: {
        item_id: wishlistItemIdField,
        name: bottleDescriptionFields.name.optional(),
        producer: clearable(bottleDescriptionFields.producer),
        vintage: clearable(bottleDescriptionFields.vintage),
        region: clearable(bottleDescriptionFields.region),
        sub_region: clearable(bottleDescriptionFields.sub_region),
        color: clearable(bottleDescriptionFields.color),
        abv: clearable(bottleDescriptionFields.abv),
        volume_ml: clearable(bottleDescriptionFields.volume_ml),
        appellation: clearable(bottleDescriptionFields.appellation),
        classification: clearable(bottleDescriptionFields.classification),
        grape_varieties: clearable(bottleDescriptionFields.grape_varieties),
        comment: clearable(commentField),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ item_id: itemId, ...input }) => {
      return runTool({
        tool: 'update_wishlist_item',
        work: async () => {
          const item = await resolveWishlistItem({ context, id: itemId });
          const patch = buildWishlistPatch({ target: item, input });
          if (Object.keys(patch).length === 0) {
            throw new ToolError('Aucun champ à modifier.');
          }
          await updateWishlistItem({ db, id: item.id, input: patch });
          return reloadItem({ context, id: item.id });
        },
      });
    },
  );

  server.registerTool(
    'delete_wishlist_item',
    {
      title: 'Retirer de la wishlist',
      description:
        'Supprime définitivement un item de la wishlist. Une bouteille déjà créée par promotion reste en cave.',
      inputSchema: { item_id: wishlistItemIdField },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ item_id: itemId }) => {
      return runTool({
        tool: 'delete_wishlist_item',
        work: async () => {
          const item = await resolveWishlistItem({ context, id: itemId });
          await deleteWishlistItem({ db, id: item.id });
          return { deleted: true, item_id: item.id, name: item.name };
        },
      });
    },
  );

  server.registerTool(
    'promote_wishlist_item',
    {
      title: 'Ranger en cave un item de wishlist',
      description:
        "La bouteille de la wishlist a été achetée : crée la bouteille dans une clayette (avec la description, le commentaire comme note personnelle, et l'analyse éventuelle), et marque l'item comme promoted. Réservé aux caves où l'utilisateur est owner ou editor. Renvoie la fiche de la bouteille créée.",
      inputSchema: {
        item_id: wishlistItemIdField,
        crate_id: crateIdField,
        quantity: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Nombre de bouteilles achetées (1 par défaut).'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'promote_wishlist_item',
        work: async () => {
          const item = await resolveWishlistItem({ context, id: input.item_id });
          if (item.status !== 'pending') {
            throw new ToolError('Cet item a déjà été rangé en cave.');
          }
          const { crate, role } = await resolveCrate({ context, id: input.crate_id });
          requireEditor(role);
          const { bottleId } = await promoteWishlistItem({
            db,
            item,
            input: { crateId: crate.id, quantity: input.quantity ?? 1 },
          });
          const promoted = await resolveBottle({ context, id: bottleId });
          return {
            item_id: item.id,
            bottle: presentBottleDetail({ ...promoted, currentYear: parisYear(), userId: user.id }),
          };
        },
      });
    },
  );
};
