import type { BottleCategory } from '@/domain/bottleCategories';
import type { GardeStatus } from '@/domain/gardeStatus';
import type { CrateRefView } from './crate-ref-view.interface';

/** Bouteille telle que listée par search_bottles. */
export interface BottleSummaryView {
  bottle_id: string;
  name: string;
  producer: string | null;
  category: BottleCategory;
  color: string | null;
  vintage: number | null;
  region: string | null;
  sub_region: string | null;
  appellation: string | null;
  quantity: number;
  drink_from: number | null;
  drink_until: number | null;
  garde_status: GardeStatus;
  rating: number | null;
  crate: CrateRefView;
}
