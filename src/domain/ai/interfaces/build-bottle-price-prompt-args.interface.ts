import type { BottleAnalysisInput } from './bottle-analysis-input.interface';

export interface BuildBottlePricePromptArgs {
  /** Mêmes champs que pour l'analyse : ce qui identifie la bouteille suffit à la chercher. */
  readonly bottle: BottleAnalysisInput;
}
