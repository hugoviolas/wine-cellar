import type { BottleWithCrate } from './bottle-with-crate.interface';

export interface BuildWineListArgs {
  readonly rows: readonly BottleWithCrate[];
  readonly currentYear: number;
}
