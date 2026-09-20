import { aiPriceEstimateSchema } from './schemas';
import type { AiPriceEstimate } from './schemas';

/**
 * Estimation de prix relue depuis la colonne JSON `bottles.ai_price_estimate`.
 *
 * Même précaution que `stringArrayOrEmpty` pour les accords : SQLite ne
 * contraint pas ce qu'on a écrit dans une colonne JSON, et la valeur arrive
 * donc en `unknown`. On la revalide avec le schéma qui a servi à l'écrire
 * plutôt que de la transtyper — une ligne écrite par une version
 * antérieure, ou éditée à la main en base, ne doit pas faire planter le
 * rendu de la fiche, juste ne rien afficher.
 */
export const parseAiPriceEstimate = (value: unknown): AiPriceEstimate | null => {
  const parsed = aiPriceEstimateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
