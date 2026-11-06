import type { DbOrTx } from '../../../db/client';

export interface CheckAuthorizationRequestArgs {
  db: DbOrTx;
  /** Paramètres de la demande, tels que reçus (query string ou formulaire). */
  params: unknown;
  /** Adresse de la ressource protégée (`<MCP_PUBLIC_URL>/mcp`). */
  resourceUrl: string;
}
