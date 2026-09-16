import type { Db } from '../../db/client';

export interface ReorderBottlesInCrateArgs {
  readonly db: Db;
  readonly crateId: string;
  readonly orderedIds: string[];
}
