import type { PatchTarget } from './patch-target.interface';

export interface BuildPatchArgs<Input> {
  target: PatchTarget;
  input: Input;
}
