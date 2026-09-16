import type { Db } from '../../db/client';

export interface GetUserByIdArgs {
  readonly db: Db;
  readonly userId: string;
}
