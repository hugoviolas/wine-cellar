import type { Db } from '../../db/client';

export interface ListCratesArgs {
  readonly db: Db;
  readonly cellarId: string;
}
