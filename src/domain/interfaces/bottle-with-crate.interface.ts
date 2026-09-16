import type { BottleRow, CrateRow } from '../../db/rows';

/** Bouteille jointe à sa clayette, forme renvoyée par les listes de cave. */
export interface BottleWithCrate {
  readonly bottle: BottleRow;
  readonly crate: CrateRow;
}
