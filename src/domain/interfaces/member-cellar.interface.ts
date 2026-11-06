import type { CellarRow } from '../../db/rows';

/** Cave et rôle qu'y tient l'utilisateur. */
export interface MemberCellar {
  readonly cellar: CellarRow;
  readonly role: 'owner' | 'editor' | 'reader';
}
