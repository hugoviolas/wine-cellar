export interface BuildBottleDetailsArgs {
  /** Catégorie de la bouteille : elle seule décide des clés à produire. */
  readonly category: string;
  /** Saisie brute du champ cépages, séparée par des virgules. */
  readonly grapeVarieties: string;
  readonly appellation: string;
  readonly classification: string;
}
