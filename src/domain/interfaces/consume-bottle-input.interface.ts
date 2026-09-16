export interface ConsumeBottleInput {
  bottleId: string;
  consumedByUserId: string;
  consumedAt: string;
  quantity?: number;
  rating?: number;
  comment?: string;
  occasion?: string;
}
