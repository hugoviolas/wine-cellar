import type Anthropic from '@anthropic-ai/sdk';
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
  /** Outils serveur joints à l'appel (voir `WEB_SEARCH_TOOL`). */
  readonly tools?: Anthropic.Messages.ToolUnion[];
  /** Plafond de tokens de la réponse, quand le défaut est trop serré. */
  readonly maxTokens?: number;
}
