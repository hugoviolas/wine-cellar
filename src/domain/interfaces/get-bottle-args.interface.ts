import type { Db } from '../../db/client';

export interface GetBottleArgs {
  readonly db: Db;
  readonly bottleId: string;
}
