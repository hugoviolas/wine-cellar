import type { BottleCategory } from '../bottleCategories';

export interface CreateWishlistItemInput {
  userId: string;
  category: BottleCategory;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  subRegion?: string;
  color?: string;
  abv?: number;
  volumeMl?: number;
  details: unknown;
  comment?: string;
}
