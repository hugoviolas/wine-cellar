import type { Db } from '../../db/client';

export interface GetInvitationByTokenArgs {
  readonly db: Db;
  readonly token: string;
}
