import type { GardeStatus } from '../gardeStatus';
import type { CrateSummary } from './crate-summary.interface';
import type { RegionCount } from './region-count.interface';

/** Synthèse d'une cave ; tous les comptes sont des bouteilles en stock. */
export interface CellarSummary {
  readonly bottles: number;
  readonly references: number;
  /** Références dont il ne reste rien, gardées pour l'historique. */
  readonly finishedReferences: number;
  /** Somme des capacités des clayettes. */
  readonly capacity: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly byColor: Readonly<Record<string, number>>;
  readonly byGardeStatus: Readonly<Partial<Record<GardeStatus, number>>>;
  readonly topRegions: readonly RegionCount[];
  readonly otherRegionsBottles: number;
  readonly oldestVintage: number | null;
  readonly newestVintage: number | null;
  readonly crates: readonly CrateSummary[];
}
