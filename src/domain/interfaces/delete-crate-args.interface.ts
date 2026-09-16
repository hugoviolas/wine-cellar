import type { Db } from '../../db/client';

export interface DeleteCrateArgs {
  readonly db: Db;
  readonly crateId: string;
}
