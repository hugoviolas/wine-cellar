import type { Db } from '../../../db/client';
import type { ClientCredentials } from './client-credentials.interface';

export interface AuthenticateClientArgs {
  db: Db;
  credentials: ClientCredentials;
}
