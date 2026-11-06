export interface BottleRow {
  id: string;
  name: string;
  category: string;
  producer: string | null;
  vintage: number | null;
  volumeMl: number | null;
  quantity: number;
  color: string | null;
}
