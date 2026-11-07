import type { DetailsInput } from './details-input.interface';

/**
 * Champs descriptifs modifiables, communs à une bouteille et à un item de
 * wishlist : absent = inchangé, `null` = effacé.
 */
export interface DescriptionPatchInput extends DetailsInput {
  name?: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  sub_region?: string | null;
  color?: string | null;
  abv?: number | null;
  volume_ml?: number | null;
}
