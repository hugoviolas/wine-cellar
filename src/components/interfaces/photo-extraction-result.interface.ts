export interface PhotoExtractionResult {
  name: string | null;
  producer: string | null;
  vintage: number | null;
  category: 'wine' | 'sparkling' | 'cider' | 'beer' | 'spirit' | null;
  color: 'rouge' | 'blanc' | 'rose' | 'autre' | null;
  region: string | null;
  subRegion: string | null;
  grapeVarieties: string[] | null;
  appellation: string | null;
}
