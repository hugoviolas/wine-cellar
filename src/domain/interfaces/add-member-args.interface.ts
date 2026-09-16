import type { Db } from '../../db/client';

export interface AddMemberArgs {
  readonly db: Db;
  readonly cellarId: string;
  readonly email: string;
  readonly role: 'editor' | 'reader';
}
