import type { SessionValidityUser } from './session-validity-user.interface';

export interface IsSessionStillValidArgs {
  readonly user: SessionValidityUser;
  readonly issuedAt: string | undefined;
}
