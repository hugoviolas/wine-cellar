import { eq } from 'drizzle-orm';
import { bottles, wishlistItems } from '../db/schema';
import { getAppellation } from './bottleCategories';
import { resolveWineGeography } from './wineGeography';
import type { BackfillWineGeographyArgs } from './interfaces/backfill-wine-geography-args.interface';
import type { GeographyBackfillChange } from './interfaces/geography-backfill-change.interface';
import type { GeographyBackfillReport } from './interfaces/geography-backfill-report.interface';
import type { BottleCategory } from './bottleCategories';

interface GeographyRow {
  readonly id: string;
  readonly name: string;
  readonly category: BottleCategory;
  readonly region: string | null;
  readonly subRegion: string | null;
  readonly details: unknown;
}

/**
 * Recale la géographie d'une ligne, ou `null` si elle est déjà canonique.
 * `null` est ce qui rend le script idempotent : une seconde exécution ne
 * trouve plus rien à écrire.
 */
const planChange = (
  table: GeographyBackfillChange['table'],
  row: GeographyRow,
): GeographyBackfillChange | null => {
  const resolved = resolveWineGeography({
    region: row.region,
    subRegion: row.subRegion,
    appellation: getAppellation({ category: row.category, details: row.details }),
  });
  if (resolved.region === row.region && resolved.subRegion === row.subRegion) {
    return null;
  }
  return {
    table,
    id: row.id,
    name: row.name,
    from: { region: row.region, subRegion: row.subRegion },
    to: resolved,
  };
};

/**
 * Applique `resolveWineGeography` à toutes les bouteilles et à tous les
 * items de wishlist déjà en base, et rend le détail de ce qui a changé.
 *
 * Idempotent : une ligne déjà canonique n'est pas réécrite, donc relancer le
 * script ne produit aucun changement. C'est aussi ce qui permet de le
 * relancer sans risque après avoir enrichi la table des appellations.
 *
 * Tout est chargé en mémoire d'un bloc, volontairement : une cave est bornée
 * par construction (des clayettes de capacité finie), on parle de centaines
 * de lignes, pas d'un flux.
 */
export const backfillWineGeography = async ({
  db,
}: BackfillWineGeographyArgs): Promise<GeographyBackfillReport> => {
  const changes: GeographyBackfillChange[] = [];
  const skipped: string[] = [];
  let scanned = 0;

  const bottleRows = await db.select().from(bottles);
  const wishlistRows = await db.select().from(wishlistItems);
  scanned = bottleRows.length + wishlistRows.length;

  for (const row of bottleRows) {
    try {
      const change = planChange('bottles', row);
      if (change) {
        await db
          .update(bottles)
          .set({ region: change.to.region, subRegion: change.to.subRegion })
          .where(eq(bottles.id, row.id));
        changes.push(change);
      }
    } catch {
      // `details` illisible pour cette catégorie : on la signale plutôt que
      // de deviner. Rien n'est écrit sur cette ligne.
      skipped.push(`bottles/${row.id}`);
    }
  }

  for (const row of wishlistRows) {
    try {
      const change = planChange('wishlist_items', row);
      if (change) {
        await db
          .update(wishlistItems)
          .set({ region: change.to.region, subRegion: change.to.subRegion })
          .where(eq(wishlistItems.id, row.id));
        changes.push(change);
      }
    } catch {
      skipped.push(`wishlist_items/${row.id}`);
    }
  }

  return { scanned, changes, skipped };
};
