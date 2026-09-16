import type { BottleCategory } from '../bottleCategories';

export interface GetAppellationArgs {
  readonly category: BottleCategory;
  readonly details: unknown;
}
