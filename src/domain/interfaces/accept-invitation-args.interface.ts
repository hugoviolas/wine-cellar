import type { Db } from '../../db/client';

export interface AcceptInvitationArgs {
  readonly db: Db;
  readonly token: string;
  readonly userId: string;
}
