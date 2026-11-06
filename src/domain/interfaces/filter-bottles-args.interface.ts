import type { BottleFilters } from './bottle-filters.interface';
import type { BottleWithCrate } from './bottle-with-crate.interface';

export interface FilterBottlesArgs {
  rows: readonly BottleWithCrate[];
  filters: BottleFilters;
  /** Année de référence de la fenêtre de garde. */
  currentYear: number;
}
