import type { CrateRow } from '@/db/rows';
import type { MemberRole } from '@/domain/access';

export interface ResolvedCrate {
  readonly crate: CrateRow;
  readonly role: MemberRole;
}
