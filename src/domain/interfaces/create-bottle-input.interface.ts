import type { BottleCategory } from '../bottleCategories';

export interface CreateBottleInput {
  crateId: string;
  category: BottleCategory;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  color?: string;
  abv?: number;
  volumeMl?: number;
  quantity: number;
  drinkFrom?: number;
  drinkUntil?: number;
  details: unknown;
  /**
   * Note personnelle posée dès la création. Volontairement absente de
   * `createBottleBodySchema` : le formulaire d'ajout ne la propose pas
   * (elle s'édite ensuite depuis la fiche). Sert à la promotion d'un item
   * de wishlist, qui y reverse son commentaire.
   */
  userNote?: string;
  /**
   * Analyse IA déjà produite, reprise telle quelle. Même raison que
   * `userNote` : absente de `createBottleBodySchema`, elle ne sert qu'à la
   * promotion d'un item de wishlist déjà analysé, pour éviter de repayer
   * un appel sur la bouteille créée.
   */
  aiAnalysis?: string | null;
  aiPairings?: unknown;
  aiTastingAdvice?: string | null;
  aiGeneratedAt?: string | null;
}
