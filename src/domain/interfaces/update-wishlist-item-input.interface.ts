export interface UpdateWishlistItemInput {
  name?: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  color?: string | null;
  abv?: number | null;
  volumeMl?: number | null;
  details?: unknown;
  comment?: string | null;
}
