import type { Db } from '../../db/client';

export interface ListBottleConsumptionsArgs {
  readonly db: Db;
  readonly bottleId: string;
}
