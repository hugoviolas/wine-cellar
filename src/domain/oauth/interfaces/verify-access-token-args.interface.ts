import type { Db } from '../../../db/client';

export interface VerifyAccessTokenArgs {
  db: Db;
  token: string;
}
