import type { BottleCategory } from '../bottleCategories';
import type { GardeStatus } from '../gardeStatus';

/** Critères de recherche dans une cave ; un critère absent ne filtre rien. */
export interface BottleFilters {
  /** Mots à retrouver tous, sans tenir compte des accents ni de la casse. */
  query?: string;
  category?: BottleCategory;
  color?: string;
  /** Région ou sous-région contenant ce texte. */
  region?: string;
  gardeStatus?: GardeStatus;
  vintageFrom?: number;
  vintageTo?: number;
  crateId?: string;
  /** Inclure les bouteilles dont il ne reste plus rien (quantité 0). */
  includeFinished?: boolean;
}
