import type { GardeStatus } from '@/domain/gardeStatus';

export interface WineListRow {
  id: string;
  name: string;
  producer: string | null;
  category: string;
  color: string | null;
  vintage: number | null;
  quantity: number;
  rating: number | null;
  gardeStatus: GardeStatus;
  createdAt: string;
}
