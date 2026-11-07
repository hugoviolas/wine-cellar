import type { DbOrTx } from '../../../db/client';

export interface GetClientArgs {
  db: DbOrTx;
  clientId: string;
}
