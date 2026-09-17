/** Colonnes écrites après une génération IA (bouteille ou item de wishlist). */
export interface AiAnalysisPatch {
  aiAnalysis: string;
  aiPairings: string[];
  aiTastingAdvice: string;
  aiGeneratedAt: string;
  drinkFrom?: number;
  drinkUntil?: number;
  region?: string | null;
  subRegion?: string | null;
  details?: unknown;
}
