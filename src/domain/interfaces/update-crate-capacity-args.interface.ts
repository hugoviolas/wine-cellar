import type { Db } from '../../db/client';

export interface UpdateCrateCapacityArgs {
  readonly db: Db;
  readonly crateId: string;
  readonly capacity: number;
}
