import type { BottleRow, CrateRow } from '@/db/rows';
import type { MemberRole } from '@/domain/access';

export interface ResolvedBottle {
  readonly bottle: BottleRow & { crateId: string };
  readonly crate: CrateRow;
  readonly role: MemberRole;
}
