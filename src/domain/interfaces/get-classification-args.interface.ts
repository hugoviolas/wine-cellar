import type { BottleCategory } from '../bottleCategories';

export interface GetClassificationArgs {
  readonly category: BottleCategory;
  readonly details: unknown;
}
