import type { Db } from '../../../db/client';
import type { OAuthClientRow } from '../../../db/rows';

export interface ExchangeAuthorizationCodeArgs {
  db: Db;
  /** Client déjà authentifié (voir `authenticateClient`). */
  client: OAuthClientRow;
  code: string;
  codeVerifier: string;
  redirectUri: string | null;
}
