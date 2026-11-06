import type { BottleRow, CrateRow } from '@/db/rows';

export interface PresentBottleArgs {
  bottle: BottleRow;
  crate: CrateRow;
  currentYear: number;
}
