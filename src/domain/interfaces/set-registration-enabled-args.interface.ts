import type { Db } from '../../db/client';

export interface SetRegistrationEnabledArgs {
  readonly db: Db;
  readonly enabled: boolean;
}
