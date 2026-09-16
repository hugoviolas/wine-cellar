import type { Db } from '../../db/client';

export interface AuthenticateUserArgs {
  readonly db: Db;
  readonly email: string;
  readonly password: string;
}
