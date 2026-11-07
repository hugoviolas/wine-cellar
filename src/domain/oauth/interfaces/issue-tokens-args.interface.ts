import type { DbOrTx } from '../../../db/client';

export interface IssueTokensArgs {
  db: DbOrTx;
  clientId: string;
  userId: string;
  grantId: string;
  /** Heure de l'autorisation d'origine, conservée d'un renouvellement à l'autre. */
  grantedAt: string;
}
