import type { Db } from '../../db/client';

export interface CreateUserAccountArgs {
  readonly db: Db;
  readonly email: string;
  readonly password: string;
}
