import { eq, desc, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { consumptionHistory, bottles } from '../db/schema';
import type { ConsumptionHistoryRow } from '../db/rows';
import { checkCellarAccess, type CellarRole } from './access';
import type { HistoryEntryWithReachability } from './interfaces/history-entry-with-reachability.interface';
import { FIELD_MAX } from './fieldLimits';
import type { ListConsumptionHistoryArgs } from './interfaces/list-consumption-history-args.interface';
import type { ListBottleConsumptionsArgs } from './interfaces/list-bottle-consumptions-args.interface';
import type { ResolveHistoryEntryAccessArgs } from './interfaces/resolve-history-entry-access-args.interface';
import type { UpdateHistoryEntryArgs } from './interfaces/update-history-entry-args.interface';
import type { DeleteHistoryEntryArgs } from './interfaces/delete-history-entry-args.interface';

/**
 * `bottleReachable` : vrai seulement si la bouteille existe encore ET a
 * toujours une clayette (une bouteille dont la clayette a été supprimée
 * devient orpheline — `resolveBottleAccess` la traite comme introuvable,
 * faute de moyen de vérifier l'appartenance à une cave). Permet à l'UI de
 * ne proposer un lien vers la fiche bouteille que lorsqu'il mène réellement
 * quelque part.
 */
export const listConsumptionHistory = async ({
  db,
  cellarId,
}: ListConsumptionHistoryArgs): Promise<HistoryEntryWithReachability[]> => {
  return db
    .select({ ...getTableColumns(consumptionHistory), bottleReachable: bottles.crateId })
    .from(consumptionHistory)
    .leftJoin(bottles, eq(consumptionHistory.bottleId, bottles.id))
    .where(eq(consumptionHistory.cellarId, cellarId))
    .orderBy(desc(consumptionHistory.consumedAt));
};

/**
 * Consommations d'une bouteille précise, de la plus récente à la plus
 * ancienne — le pendant « une bouteille » de `listConsumptionHistory`.
 *
 * La fiche bouteille n'avait aucun moyen de les lire : ce qu'on saisit en
 * consommant (le commentaire de dégustation surtout, mais aussi la note,
 * l'occasion et la date) n'apparaissait que dans la liste d'historique,
 * alors que c'est de cette bouteille-là que ça parle.
 *
 * Pas de filtre de cave ici : l'appelant a déjà résolu l'accès à la
 * bouteille (voir `resolveBottleAccess`), et une entrée d'historique
 * appartient forcément à la cave de sa bouteille.
 */
export const listBottleConsumptions = async ({
  db,
  bottleId,
}: ListBottleConsumptionsArgs): Promise<ConsumptionHistoryRow[]> => {
  return db
    .select()
    .from(consumptionHistory)
    .where(eq(consumptionHistory.bottleId, bottleId))
    .orderBy(desc(consumptionHistory.consumedAt));
};

export type HistoryEntryAccessResult =
  | { status: 'ok'; entry: typeof consumptionHistory.$inferSelect; role: CellarRole }
  | { status: 'not_found' }
  | { status: 'forbidden' };

export const resolveHistoryEntryAccess = async ({
  db,
  userId,
  entryId,
}: ResolveHistoryEntryAccessArgs): Promise<HistoryEntryAccessResult> => {
  const [entry] = await db
    .select()
    .from(consumptionHistory)
    .where(eq(consumptionHistory.id, entryId))
    .limit(1);
  if (!entry) {
    return { status: 'not_found' };
  }
  const access = await checkCellarAccess({ db, userId, cellarId: entry.cellarId });
  if (!access.allowed) {
    return { status: 'forbidden' };
  }
  return { status: 'ok', entry, role: access.role };
};

/**
 * Champs modifiables d'une entrée d'historique : les valeurs saisies par
 * l'utilisateur au moment de la consommation (date, quantité, note,
 * commentaire, occasion). Les champs "snapshot" (nom/producteur/millésime/
 * catégorie de la bouteille au moment de la conso) ne sont volontairement
 * pas éditables — ce sont des faits historiques, pas des préférences.
 */
export const updateHistoryEntryBodySchema = z
  .object({
    consumedAt: z.string().min(1).max(FIELD_MAX.shortText).optional(),
    quantity: z.number().int().min(1).optional(),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    comment: z.string().max(FIELD_MAX.longText).nullable().optional(),
    occasion: z.string().max(FIELD_MAX.shortText).nullable().optional(),
  })
  .strict();
export type UpdateHistoryEntryInput = z.infer<typeof updateHistoryEntryBodySchema>;

export const updateHistoryEntry = async ({ db, entryId, input }: UpdateHistoryEntryArgs): Promise<void> => {
  await db.update(consumptionHistory).set(input).where(eq(consumptionHistory.id, entryId));
};

export const deleteHistoryEntry = async ({ db, entryId }: DeleteHistoryEntryArgs): Promise<void> => {
  await db.delete(consumptionHistory).where(eq(consumptionHistory.id, entryId));
};
