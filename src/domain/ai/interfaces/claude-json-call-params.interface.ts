import type { z } from 'zod';
import type { AiMessageContent } from '../client';

export interface ClaudeJsonCallParams<T> {
  system: string;
  content: AiMessageContent;
  schema: z.ZodType<T>;
  /** Plafond de tokens de la réponse, quand le défaut est trop serré. */
  maxTokens?: number;
  /** Budget de temps de l'appel entier, quand le défaut ne convient pas. */
  budgetMs?: number;
}
