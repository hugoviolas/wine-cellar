import type { Db } from '../../db/client';

export interface NextAvailableCrateNumberArgs {
  readonly db: Db;
  readonly cellarId: string;
}
