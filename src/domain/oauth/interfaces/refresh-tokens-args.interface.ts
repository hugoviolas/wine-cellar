import type { Db } from '../../../db/client';
import type { OAuthClientRow } from '../../../db/rows';

export interface RefreshTokensArgs {
  db: Db;
  /** Client déjà authentifié (voir `authenticateClient`). */
  client: OAuthClientRow;
  refreshToken: string;
}
