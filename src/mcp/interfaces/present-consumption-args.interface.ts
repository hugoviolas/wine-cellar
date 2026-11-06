import type { ConsumptionHistoryRow } from '@/db/rows';

export interface PresentConsumptionArgs {
  entry: ConsumptionHistoryRow;
  /** Vrai si la bouteille d'origine est encore rangée dans une cave. */
  bottleReachable: boolean;
  userId: string;
}
