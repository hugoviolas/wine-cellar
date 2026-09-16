import { eq } from 'drizzle-orm';
import type { CellarRow } from '../db/rows';
import type { UpdateCellarInfoInput } from './interfaces/update-cellar-info-input.interface';
import { cellars } from '../db/schema';
import type { GetCellarByIdArgs } from './interfaces/get-cellar-by-id-args.interface';
import type { UpdateCellarInfoArgs } from './interfaces/update-cellar-info-args.interface';

export type { UpdateCellarInfoInput };

export const getCellarById = async ({ db, cellarId }: GetCellarByIdArgs): Promise<CellarRow | null> => {
  const [row] = await db.select().from(cellars).where(eq(cellars.id, cellarId)).limit(1);
  return row ?? null;
};

/** Une chaîne vide efface le champ (stocké `null`), comme pour le nom d'une clayette. `name` est requis (non nullable) et déjà validé non-vide par le schéma zod appelant. */
export const updateCellarInfo = async ({ db, cellarId, input }: UpdateCellarInfoArgs): Promise<void> => {
  const set: Record<string, string | null> = {};
  if (input.name !== undefined) {
    set.name = input.name.trim();
  }
  if (input.brand !== undefined) {
    set.brand = input.brand?.trim() || null;
  }
  if (input.model !== undefined) {
    set.model = input.model?.trim() || null;
  }
  if (input.notes !== undefined) {
    set.notes = input.notes?.trim() || null;
  }
  if (Object.keys(set).length === 0) {
    return;
  }
  await db.update(cellars).set(set).where(eq(cellars.id, cellarId));
};
