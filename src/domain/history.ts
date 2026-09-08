import { eq, desc, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { consumptionHistory, bottles } from '../db/schema';
import { checkCellarAccess, type CellarRole } from './access';

/**
 * `bottleReachable` : vrai seulement si la bouteille existe encore ET a
 * toujours une clayette (une bouteille dont la clayette a été supprimée
 * devient orpheline — `resolveBottleAccess` la traite comme introuvable,
 * faute de moyen de vérifier l'appartenance à une cave). Permet à l'UI de
 * ne proposer un lien vers la fiche bouteille que lorsqu'il mène réellement
 * quelque part.
 */
export async function listConsumptionHistory(db: Db, cellarId: string) {
  return db
    .select({ ...getTableColumns(consumptionHistory), bottleReachable: bottles.crateId })
    .from(consumptionHistory)
    .leftJoin(bottles, eq(consumptionHistory.bottleId, bottles.id))
    .where(eq(consumptionHistory.cellarId, cellarId))
    .orderBy(desc(consumptionHistory.consumedAt));
}

export type HistoryEntryAccessResult =
  | { status: 'ok'; entry: typeof consumptionHistory.$inferSelect; role: CellarRole }
  | { status: 'not_found' }
  | { status: 'forbidden' };

export async function resolveHistoryEntryAccess(
  db: Db,
  userId: string,
  entryId: string,
): Promise<HistoryEntryAccessResult> {
  const [entry] = await db.select().from(consumptionHistory).where(eq(consumptionHistory.id, entryId)).limit(1);
  if (!entry) return { status: 'not_found' };
  const access = await checkCellarAccess(db, userId, entry.cellarId);
  if (!access.allowed) return { status: 'forbidden' };
  return { status: 'ok', entry, role: access.role };
}

/**
 * Champs modifiables d'une entrée d'historique : les valeurs saisies par
 * l'utilisateur au moment de la consommation (date, quantité, note,
 * commentaire, occasion). Les champs "snapshot" (nom/producteur/millésime/
 * catégorie de la bouteille au moment de la conso) ne sont volontairement
 * pas éditables — ce sont des faits historiques, pas des préférences.
 */
export const updateHistoryEntryBodySchema = z
  .object({
    consumedAt: z.string().min(1).optional(),
    quantity: z.number().int().min(1).optional(),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    comment: z.string().nullable().optional(),
    occasion: z.string().nullable().optional(),
  })
  .strict();
export type UpdateHistoryEntryInput = z.infer<typeof updateHistoryEntryBodySchema>;

export async function updateHistoryEntry(db: Db, entryId: string, input: UpdateHistoryEntryInput): Promise<void> {
  await db.update(consumptionHistory).set(input).where(eq(consumptionHistory.id, entryId));
}

export async function deleteHistoryEntry(db: Db, entryId: string): Promise<void> {
  await db.delete(consumptionHistory).where(eq(consumptionHistory.id, entryId));
}
