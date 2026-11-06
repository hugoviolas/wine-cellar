import type { ConsumptionHistoryRow } from '@/db/rows';
import type { MemberRole } from '@/domain/access';

export interface ResolvedHistoryEntry {
  readonly entry: ConsumptionHistoryRow;
  readonly role: MemberRole;
}
