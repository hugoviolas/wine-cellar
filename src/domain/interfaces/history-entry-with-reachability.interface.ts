import type { ConsumptionHistoryRow } from '../../db/rows';

/**
 * Entrée d'historique enrichie d'un indicateur : `bottleReachable` porte la
 * clayette de la bouteille consommée (nulle si la bouteille a disparu ou
 * est devenue orpheline). L'UI ne propose un lien vers la fiche que
 * lorsqu'il mène réellement quelque part.
 */
export interface HistoryEntryWithReachability extends ConsumptionHistoryRow {
  readonly bottleReachable: string | null;
}
