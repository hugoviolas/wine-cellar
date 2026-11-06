import { groupSameWines } from './bottleIdentity';
import { computeGardeStatus } from './gardeStatus';
import { crateLabel } from '@/lib/crateLabel';
import type { BottleRow, CrateRow } from '../db/rows';
import type { BuildWineListArgs } from './interfaces/build-wine-list-args.interface';
import type { WineListEntry } from './interfaces/wine-list-entry.interface';

export type { WineListEntry };

type LotWithCrate = BottleRow & { readonly crate: CrateRow };

const byCrateOrder = (a: LotWithCrate, b: LotWithCrate): number => {
  return a.crate.sortOrder - b.crate.sortOrder || a.crate.number - b.crate.number;
};

/**
 * Liste des vins de la cave : les lots d'un même vin répartis sur
 * plusieurs clayettes n'y font qu'une ligne, avec le total et le détail par
 * clayette. Les champs propres à un lot (note, garde) viennent du lot le
 * plus fourni — après une fusion ou une scission, ils sont de toute façon
 * identiques d'un lot à l'autre.
 */
export const buildWineList = ({ rows, currentYear }: BuildWineListArgs): WineListEntry[] => {
  const lots = rows.map(({ bottle, crate }) => ({ ...bottle, crate }));
  return groupSameWines(lots).flatMap((group) => {
    const ordered = [...group].sort(byCrateOrder);
    const main = ordered.reduce<LotWithCrate | undefined>(
      (best, lot) => (best === undefined || lot.quantity > best.quantity ? lot : best),
      undefined,
    );
    if (!main) {
      return [];
    }
    return [
      {
        id: main.id,
        name: main.name,
        producer: main.producer,
        category: main.category,
        color: main.color,
        vintage: main.vintage,
        quantity: ordered.reduce((total, lot) => total + lot.quantity, 0),
        rating: main.rating ?? ordered.find((lot) => lot.rating !== null)?.rating ?? null,
        gardeStatus: computeGardeStatus({
          drinkFrom: main.drinkFrom,
          drinkUntil: main.drinkUntil,
          currentYear,
        }),
        createdAt: ordered.reduce(
          (oldest, lot) => (lot.createdAt < oldest ? lot.createdAt : oldest),
          main.createdAt,
        ),
        lots: ordered.map((lot) => ({
          id: lot.id,
          crateLabel: crateLabel({ number: lot.crate.number, name: lot.crate.name }),
          quantity: lot.quantity,
        })),
      },
    ];
  });
};
