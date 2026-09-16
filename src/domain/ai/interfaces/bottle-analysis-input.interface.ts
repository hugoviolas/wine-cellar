export interface BottleAnalysisInput {
  name: string;
  producer: string | null;
  vintage: number | null;
  category: string;
  region: string | null;
  color: string | null;
  grapeVarieties: string[];
  appellation: string | null;
}
