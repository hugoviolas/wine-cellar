import type { Db } from '../../../db/client';
import type { OAuthTokenRow } from '../../../db/rows';

export interface RevokeReusedGrantArgs {
  db: Db;
  /** Refresh token consommé qui vient d'être présenté à nouveau. */
  token: OAuthTokenRow;
}
