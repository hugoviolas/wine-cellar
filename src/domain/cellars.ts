import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cellars } from '../db/schema';

export async function getCellarById(db: Db, cellarId: string) {
  const [row] = await db.select().from(cellars).where(eq(cellars.id, cellarId)).limit(1);
  return row ?? null;
}

export interface UpdateCellarInfoInput {
  name?: string;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
}

/** Une chaîne vide efface le champ (stocké `null`), comme pour le nom d'une clayette. `name` est requis (non nullable) et déjà validé non-vide par le schéma zod appelant. */
export async function updateCellarInfo(db: Db, cellarId: string, input: UpdateCellarInfoInput): Promise<void> {
  const set: Record<string, string | null> = {};
  if (input.name !== undefined) set.name = input.name.trim();
  if (input.brand !== undefined) set.brand = input.brand?.trim() || null;
  if (input.model !== undefined) set.model = input.model?.trim() || null;
  if (input.notes !== undefined) set.notes = input.notes?.trim() || null;
  if (Object.keys(set).length === 0) return;
  await db.update(cellars).set(set).where(eq(cellars.id, cellarId));
}
