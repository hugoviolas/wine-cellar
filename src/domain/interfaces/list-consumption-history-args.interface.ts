import type { Db } from '../../db/client';

export interface ListConsumptionHistoryArgs {
  readonly db: Db;
  readonly cellarId: string;
}
