import type { BottleCategory } from '@/domain/bottleCategories';

/** Ce qu'il faut savoir de la ligne modifiée pour construire son patch. */
export interface PatchTarget {
  category: BottleCategory;
  details: unknown;
}
