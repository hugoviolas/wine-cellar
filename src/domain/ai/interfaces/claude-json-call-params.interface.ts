import type Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import type { AiMessageContent } from '../client';

export interface ClaudeJsonCallParams<T> {
  system: string;
  content: AiMessageContent;
  schema: z.ZodType<T>;
  /**
   * Outils serveur (exécutés chez Anthropic, sans boucle côté app) joints à
   * l'appel — aujourd'hui la seule recherche web, pour l'estimation de prix.
   * Absent = appel sans aucun outil, comme avant.
   */
  tools?: Anthropic.Messages.ToolUnion[];
  /** Plafond de tokens de la réponse, quand le défaut est trop serré. */
  maxTokens?: number;
  /** Budget de temps de l'appel entier, quand le défaut ne convient pas. */
  budgetMs?: number;
}
