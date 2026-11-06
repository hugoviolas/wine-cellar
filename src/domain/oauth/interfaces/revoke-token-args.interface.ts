import type { Db } from '../../../db/client';
import type { OAuthClientRow } from '../../../db/rows';

export interface RevokeTokenArgs {
  db: Db;
  /** Client déjà authentifié (voir `authenticateClient`). */
  client: OAuthClientRow;
  token: string;
}
