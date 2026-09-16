import type { BottleCategory } from '../../bottleCategories';

export interface WishlistItemForAiSave {
  id: string;
  category: BottleCategory;
  drinkFrom: number | null;
  drinkUntil: number | null;
  region: string | null;
  details: unknown;
}
