import type { OAuthClientRow } from '@/db/rows';

export interface GrantArgs {
  params: Record<string, string>;
  /** Client déjà authentifié. */
  client: OAuthClientRow;
}
