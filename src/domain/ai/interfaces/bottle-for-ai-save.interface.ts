import type { BottleCategory } from '../../bottleCategories';

export interface BottleForAiSave {
  id: string;
  category: BottleCategory;
  drinkFrom: number | null;
  drinkUntil: number | null;
  region: string | null;
  details: unknown;
}
