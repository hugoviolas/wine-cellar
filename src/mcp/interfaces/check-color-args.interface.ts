import type { BottleCategory } from '@/domain/bottleCategories';

export interface CheckColorArgs {
  category: BottleCategory;
  color: string | null | undefined;
}
