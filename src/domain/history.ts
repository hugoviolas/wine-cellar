import { eq, desc, getTableColumns } from 'drizzle-orm';
import type { Db } from '../db/client';
import { consumptionHistory, bottles } from '../db/schema';

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
