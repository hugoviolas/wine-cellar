import { eq } from 'drizzle-orm';
import { cellarMemberships, cellars } from '../db/schema';
import { computeGardeStatus, type GardeStatus } from './gardeStatus';
import type { MemberCellar } from './interfaces/member-cellar.interface';
import type { ListMemberCellarsArgs } from './interfaces/list-member-cellars-args.interface';
import type { CellarSummary } from './interfaces/cellar-summary.interface';
import type { SummarizeCellarArgs } from './interfaces/summarize-cellar-args.interface';
import type { CrateSummary } from './interfaces/crate-summary.interface';
import type { RegionCount } from './interfaces/region-count.interface';

export type { MemberCellar, CellarSummary, CrateSummary };

/**
 * Caves dont l'utilisateur est membre, dans l'ordre où il les a rejointes —
 * la première est sa cave par défaut, comme dans `resolveViewedCellarId`.
 *
 * Adhésions seulement, super-admin compris : ce sont exactement les caves
 * que le MCP laisse atteindre (voir `getMemberRole`).
 */
export const listMemberCellars = async ({ db, userId }: ListMemberCellarsArgs): Promise<MemberCellar[]> => {
  return db
    .select({ cellar: cellars, role: cellarMemberships.role })
    .from(cellarMemberships)
    .innerJoin(cellars, eq(cellarMemberships.cellarId, cellars.id))
    .where(eq(cellarMemberships.userId, userId))
    .orderBy(cellarMemberships.createdAt);
};

/** Régions les plus représentées gardées dans une synthèse, les autres sont regroupées. */
const TOP_REGIONS = 15;

/**
 * Synthèse chiffrée d'une cave, en nombre de bouteilles (quantités) : par
 * catégorie, couleur, statut de garde et région, plus l'occupation de
 * chaque clayette. Fonction pure, sur des lignes déjà chargées.
 */
export const summarizeCellar = ({ rows, crates, currentYear }: SummarizeCellarArgs): CellarSummary => {
  const active = rows.filter(({ bottle }) => bottle.quantity > 0);
  const byCategory: Record<string, number> = {};
  const byColor: Record<string, number> = {};
  const byGardeStatus: Partial<Record<GardeStatus, number>> = {};
  const byRegion = new Map<string, number>();
  const byCrate = new Map<string, Omit<CrateSummary, 'crate'>>();
  let oldestVintage: number | null = null;
  let newestVintage: number | null = null;

  for (const { bottle, crate } of active) {
    const quantity = bottle.quantity;
    byCategory[bottle.category] = (byCategory[bottle.category] ?? 0) + quantity;
    if (bottle.color) {
      byColor[bottle.color] = (byColor[bottle.color] ?? 0) + quantity;
    }
    const status = computeGardeStatus({
      drinkFrom: bottle.drinkFrom,
      drinkUntil: bottle.drinkUntil,
      currentYear,
    });
    byGardeStatus[status] = (byGardeStatus[status] ?? 0) + quantity;
    const region = bottle.region ?? 'Inconnue';
    byRegion.set(region, (byRegion.get(region) ?? 0) + quantity);
    const crateTotals = byCrate.get(crate.id) ?? { bottles: 0, references: 0 };
    byCrate.set(crate.id, {
      bottles: crateTotals.bottles + quantity,
      references: crateTotals.references + 1,
    });
    if (bottle.vintage !== null) {
      oldestVintage = oldestVintage === null ? bottle.vintage : Math.min(oldestVintage, bottle.vintage);
      newestVintage = newestVintage === null ? bottle.vintage : Math.max(newestVintage, bottle.vintage);
    }
  }

  const regions: RegionCount[] = [...byRegion.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .map(([region, bottles]) => ({ region, bottles }));

  return {
    bottles: active.reduce((sum, { bottle }) => sum + bottle.quantity, 0),
    references: active.length,
    finishedReferences: rows.length - active.length,
    capacity: crates.reduce((sum, crate) => sum + crate.capacity, 0),
    byCategory,
    byColor,
    byGardeStatus,
    topRegions: regions.slice(0, TOP_REGIONS),
    otherRegionsBottles: regions.slice(TOP_REGIONS).reduce((sum, entry) => sum + entry.bottles, 0),
    oldestVintage,
    newestVintage,
    crates: crates.map((crate) => ({
      crate,
      bottles: byCrate.get(crate.id)?.bottles ?? 0,
      references: byCrate.get(crate.id)?.references ?? 0,
    })),
  };
};
