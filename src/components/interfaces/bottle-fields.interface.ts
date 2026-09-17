export interface BottleFields {
  id: string;
  category: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  subRegion: string | null;
  color: string | null;
  abv: number | null;
  volumeMl: number | null;
  grapeVarieties: string[];
  appellation: string | null;
  classification: string | null;
}
