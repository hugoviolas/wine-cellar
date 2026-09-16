import type { Db } from '../../db/client';

export interface ResolveBottleAccessArgs {
  readonly db: Db;
  readonly userId: string;
  readonly bottleId: string;
}
