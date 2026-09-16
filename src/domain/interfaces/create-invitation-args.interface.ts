import type { CreateInvitationInput } from './create-invitation-input.interface';
import type { Db } from '../../db/client';

export interface CreateInvitationArgs {
  readonly db: Db;
  readonly input: CreateInvitationInput;
}
