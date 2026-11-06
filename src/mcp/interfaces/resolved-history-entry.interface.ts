import type { ConsumptionHistoryRow } from '@/db/rows';
import type { CellarRole } from '@/domain/access';

export interface ResolvedHistoryEntry {
  readonly entry: ConsumptionHistoryRow;
  readonly role: CellarRole;
}
