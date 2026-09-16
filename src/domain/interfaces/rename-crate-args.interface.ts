import type { Db } from '../../db/client';

export interface RenameCrateArgs {
  readonly db: Db;
  readonly crateId: string;
  readonly name: string;
}
