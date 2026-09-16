export interface UpdateBottleInput {
  name?: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  color?: string | null;
  abv?: number | null;
  volumeMl?: number | null;
  quantity?: number;
  userNote?: string | null;
  rating?: number | null;
  drinkFrom?: number | null;
  drinkUntil?: number | null;
  crateId?: string;
  details?: unknown;
}
