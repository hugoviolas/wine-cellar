import type { Db } from '../../db/client';

export interface DeleteUserArgs {
  readonly db: Db;
  readonly userId: string;
}
