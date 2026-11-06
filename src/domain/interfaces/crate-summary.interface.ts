import type { CrateRow } from '../../db/rows';

export interface CrateSummary {
  readonly crate: CrateRow;
  /** Bouteilles en stock (somme des quantités). */
  readonly bottles: number;
  /** Références en stock (lignes à quantité positive). */
  readonly references: number;
}
