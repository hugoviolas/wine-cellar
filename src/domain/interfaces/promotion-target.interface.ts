export interface PromotionTarget {
  cellarId: string;
  cellarName: string;
  crates: { id: string; number: number; name: string | null; capacity: number }[];
}
