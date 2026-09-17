import type { GeographyBackfillChange } from './geography-backfill-change.interface';

export interface GeographyBackfillReport {
  readonly scanned: number;
  readonly changes: readonly GeographyBackfillChange[];
  /** Lignes dont les `details` sont illisibles : signalées, jamais réécrites à l'aveugle. */
  readonly skipped: readonly string[];
}
