export interface WishlistItemFields {
  id: string;
  category: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  color: string | null;
  grapeVarieties: string[];
  appellation: string | null;
  comment: string | null;
}
