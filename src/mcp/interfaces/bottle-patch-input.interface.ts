import type { DescriptionPatchInput } from './description-patch-input.interface';

/** Champs modifiables d'une bouteille : absent = inchangé, `null` = effacé. */
export interface BottlePatchInput extends DescriptionPatchInput {
  quantity?: number;
  drink_from?: number | null;
  drink_until?: number | null;
  user_note?: string | null;
  rating?: number | null;
  crate_id?: string;
}
