import type { Db } from '../../db/client';

export interface DeleteBottleArgs {
  readonly db: Db;
  readonly bottleId: string;
}
