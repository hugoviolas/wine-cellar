import type { DescriptionPatchInput } from './description-patch-input.interface';

export interface WishlistPatchInput extends DescriptionPatchInput {
  comment?: string | null;
}
