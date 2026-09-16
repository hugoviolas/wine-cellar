import type { Db } from '../../db/client';

export interface GetCellarByIdArgs {
  readonly db: Db;
  readonly cellarId: string;
}
