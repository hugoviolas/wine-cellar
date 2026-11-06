import type { BottleRow } from './bottle-row.interface';

/** Glisser-déposer vers une autre clayette, en attente de confirmation. */
export interface PendingBottleMove {
  readonly bottle: BottleRow;
  readonly fromCrateId: string;
  readonly toCrateId: string;
}
