import type { Db } from '../../db/client';

export interface GetCrateByIdArgs {
  readonly db: Db;
  readonly crateId: string;
}
