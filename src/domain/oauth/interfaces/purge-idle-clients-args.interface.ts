import type { Db } from '../../../db/client';

export interface PurgeIdleClientsArgs {
  db: Db;
  now: Date;
}
