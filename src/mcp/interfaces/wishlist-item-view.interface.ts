import type { BottleCategory } from '@/domain/bottleCategories';

export interface WishlistItemView {
  item_id: string;
  status: 'pending' | 'promoted';
  /** Bouteille créée à la promotion, si elle existe encore. */
  promoted_bottle_id: string | null;
  name: string;
  producer: string | null;
  category: BottleCategory;
  color: string | null;
  vintage: number | null;
  region: string | null;
  sub_region: string | null;
  appellation: string | null;
  classification: string | null;
  grape_varieties: string[];
  abv: number | null;
  volume_ml: number | null;
  comment: string | null;
  drink_from: number | null;
  drink_until: number | null;
  added_at: string;
}
