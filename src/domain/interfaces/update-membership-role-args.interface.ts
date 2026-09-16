import type { Db } from '../../db/client';

export interface UpdateMembershipRoleArgs {
  readonly db: Db;
  readonly membershipId: string;
  readonly role: 'editor' | 'reader';
}
