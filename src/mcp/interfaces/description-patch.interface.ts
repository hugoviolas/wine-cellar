/** Partie commune de `UpdateBottleInput` et `UpdateWishlistItemInput`. */
export interface DescriptionPatch {
  name?: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  subRegion?: string | null;
  color?: string | null;
  abv?: number | null;
  volumeMl?: number | null;
  details?: unknown;
}
