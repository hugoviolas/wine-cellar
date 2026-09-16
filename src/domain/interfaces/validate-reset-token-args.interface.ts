import type { Db } from '../../db/client';

export interface ValidateResetTokenArgs {
  readonly db: Db;
  readonly token: string;
}
