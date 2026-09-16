import type { Db } from '../../../db/client';

export interface SeedItemArgs {
  readonly db: Db;
  readonly details: unknown;
}
