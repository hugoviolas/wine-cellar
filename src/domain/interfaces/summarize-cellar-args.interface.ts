import type { CrateRow } from '../../db/rows';
import type { BottleWithCrate } from './bottle-with-crate.interface';

export interface SummarizeCellarArgs {
  /** Toutes les bouteilles de la cave, y compris celles à quantité 0. */
  rows: readonly BottleWithCrate[];
  crates: readonly CrateRow[];
  currentYear: number;
}
