import type { Db } from '../../db/client';

export interface ListActiveBottlesByCellarArgs {
  readonly db: Db;
  readonly cellarId: string;
}
