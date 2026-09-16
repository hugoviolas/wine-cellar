import type { Db } from '../../db/client';

export interface CheckCellarAccessArgs {
  readonly db: Db;
  readonly userId: string;
  readonly cellarId: string;
}
