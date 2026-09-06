import { eq, desc } from 'drizzle-orm';
import type { Db } from '../db/client';
import { consumptionHistory } from '../db/schema';

export async function listConsumptionHistory(db: Db, cellarId: string) {
  return db
    .select()
    .from(consumptionHistory)
    .where(eq(consumptionHistory.cellarId, cellarId))
    .orderBy(desc(consumptionHistory.consumedAt));
}
