import type { BottleRow } from '../../db/rows';

export interface BuildLotMergePatchArgs {
  /** Lot déjà présent dans la clayette, qui reçoit les bouteilles. */
  readonly target: BottleRow;
  /** Lot d'où viennent les bouteilles déplacées. */
  readonly source: BottleRow;
  /** `true` quand tout le stock de `source` part : le lot disparaît. */
  readonly absorbsSource: boolean;
}
