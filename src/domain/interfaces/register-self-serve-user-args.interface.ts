import type { Db } from '../../db/client';

export interface RegisterSelfServeUserArgs {
  readonly db: Db;
  readonly email: string;
  readonly password: string;
}
