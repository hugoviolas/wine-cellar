import type { BottlePatchInput } from './bottle-patch-input.interface';
import type { BottlePatchTarget } from './bottle-patch-target.interface';

export interface BuildBottlePatchArgs {
  target: BottlePatchTarget;
  input: BottlePatchInput;
}
