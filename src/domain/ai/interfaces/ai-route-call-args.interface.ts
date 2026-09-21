import type { z } from 'zod';
import type { AiMessageContent } from '../client';

export interface AiRouteCallArgs<T> {
  /** Identifiant de la route, repris tel quel dans les logs. */
  readonly route: string;
  readonly system: string;
  readonly content: AiMessageContent;
  readonly schema: z.ZodType<T>;
  /** Message affiché quand le modèle a répondu, mais hors du schéma attendu. */
  readonly invalidResponseMessage: string;
  /** Plafond de tokens de la réponse, quand le défaut est trop serré. */
  readonly maxTokens?: number;
  /** Budget de temps de l'appel entier, quand le défaut ne convient pas. */
  readonly budgetMs?: number;
}
