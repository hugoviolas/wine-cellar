import type { BottleAnalysisInput } from './bottle-analysis-input.interface';

export interface BuildBottleAnalysisPromptArgs {
  readonly bottle: BottleAnalysisInput;
  readonly currentYear: number;
  /**
   * Demande une estimation de prix sourcée. Réservé aux appels qui joignent
   * la recherche web (`WEB_SEARCH_TOOL`) : sans elle, le modèle n'a aucune
   * source à citer et la consigne l'inviterait à en inventer. Par défaut
   * `false`, donc le prompt wishlist reste inchangé.
   */
  readonly withPriceEstimate?: boolean;
}
