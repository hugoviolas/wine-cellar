import type { Db } from '../../db/client';

export interface CreateResetTokenArgs {
  readonly db: Db;
  readonly userId: string;
}
