import type { Db } from '../../db/client';

export interface ResetPasswordWithTokenArgs {
  readonly db: Db;
  readonly token: string;
  readonly newPassword: string;
}
