import type { WineGeography } from './wine-geography.interface';

export interface GeographyBackfillChange {
  readonly table: 'bottles' | 'wishlist_items';
  readonly id: string;
  readonly name: string;
  readonly from: WineGeography;
  readonly to: WineGeography;
}
