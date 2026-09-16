import type { Db } from '../../db/client';

export interface ListBottlesByCellarArgs {
  readonly db: Db;
  readonly cellarId: string;
}
