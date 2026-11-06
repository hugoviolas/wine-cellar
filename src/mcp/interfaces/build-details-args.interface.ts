import type { BottleCategory } from '@/domain/bottleCategories';
import type { DetailsInput } from './details-input.interface';

export interface BuildDetailsArgs {
  category: BottleCategory;
  /** Détails actuels, pour une modification ; `{}` pour une création. */
  current: unknown;
  input: DetailsInput;
}
