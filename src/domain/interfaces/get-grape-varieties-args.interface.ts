import type { BottleCategory } from '../bottleCategories';

export interface GetGrapeVarietiesArgs {
  readonly category: BottleCategory;
  readonly details: unknown;
}
