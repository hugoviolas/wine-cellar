import type { Db } from '../../db/client';

export interface ResolveViewedCellarIdArgs {
  readonly db: Db;
  readonly userId: string;
  readonly requestedCellarId: string | undefined;
}
