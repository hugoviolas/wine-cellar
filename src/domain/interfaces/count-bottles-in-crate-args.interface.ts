import type { Db } from '../../db/client';

export interface CountBottlesInCrateArgs {
  db: Db;
  crateId: string;
}
