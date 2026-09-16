import type { Db } from '../../db/client';

export interface CrateHasActiveBottlesArgs {
  readonly db: Db;
  readonly crateId: string;
}
