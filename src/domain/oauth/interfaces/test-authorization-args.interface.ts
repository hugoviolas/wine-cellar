import type { Db } from '../../../db/client';
import type { PkcePair } from './pkce-pair.interface';

export interface TestAuthorizationArgs {
  db: Db;
  clientId: string;
  userId: string;
  pkce: PkcePair;
}
