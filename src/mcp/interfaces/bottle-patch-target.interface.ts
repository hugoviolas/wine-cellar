import type { PatchTarget } from './patch-target.interface';

export interface BottlePatchTarget extends PatchTarget {
  drinkFrom: number | null;
  drinkUntil: number | null;
}
