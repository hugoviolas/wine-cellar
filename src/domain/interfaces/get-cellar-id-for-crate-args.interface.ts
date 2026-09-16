import type { DbOrTx } from '../../db/client';

export interface GetCellarIdForCrateArgs {
  readonly db: DbOrTx;
  readonly crateId: string;
}
