import type { CellarRow } from '@/db/rows';
import type { MemberRole } from '@/domain/access';

export interface ResolvedCellar {
  readonly cellar: CellarRow;
  readonly role: MemberRole;
}
