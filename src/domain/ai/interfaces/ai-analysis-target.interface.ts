import type { BottleCategory } from '../../bottleCategories';

/**
 * Ce qu'une génération IA a besoin de connaître de sa cible pour décider
 * quels champs remplir : une bouteille et un item de wishlist s'y ramènent
 * tous les deux.
 */
export interface AiAnalysisTarget {
  readonly category: BottleCategory;
  readonly drinkFrom: number | null;
  readonly drinkUntil: number | null;
  readonly region: string | null;
  readonly subRegion: string | null;
  readonly details: unknown;
}
