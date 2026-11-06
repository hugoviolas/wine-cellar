import { computeGardeStatus } from './gardeStatus';
import { getAppellation, getClassification, getGrapeVarieties } from './bottleCategories';
import type { BottleWithCrate } from './interfaces/bottle-with-crate.interface';
import type { FilterBottlesArgs } from './interfaces/filter-bottles-args.interface';

/**
 * Forme comparable d'un texte : minuscules, sans accents. « Côte-Rôtie »,
 * « cote-rotie » et « COTE-RÔTIE » se retrouvent ainsi l'un l'autre.
 */
export const normalizeForSearch = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

/** Tout ce sur quoi une recherche libre peut tomber pour une bouteille. */
const searchableText = ({ bottle, crate }: BottleWithCrate): string => {
  const { category, details } = bottle;
  return normalizeForSearch(
    [
      bottle.name,
      bottle.producer,
      bottle.region,
      bottle.subRegion,
      bottle.vintage === null ? null : String(bottle.vintage),
      getAppellation({ category, details }),
      getClassification({ category, details }),
      ...getGrapeVarieties({ category, details }),
      crate.name,
    ]
      .filter((part) => part !== null && part !== '')
      .join(' '),
  );
};

/**
 * Filtre les bouteilles d'une cave. Tous les critères fournis doivent être
 * satisfaits ; la recherche libre exige chacun de ses mots, dans n'importe
 * quel champ. En mémoire plutôt qu'en SQL : SQLite ne sait pas comparer en
 * ignorant les accents, et une cave tient en quelques centaines de lignes.
 */
export const filterBottles = ({ rows, filters, currentYear }: FilterBottlesArgs): BottleWithCrate[] => {
  const words = normalizeForSearch(filters.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const region = filters.region === undefined ? null : normalizeForSearch(filters.region);

  return rows.filter((row) => {
    const { bottle, crate } = row;
    if (!filters.includeFinished && bottle.quantity <= 0) {
      return false;
    }
    if (filters.category !== undefined && bottle.category !== filters.category) {
      return false;
    }
    if (filters.color !== undefined && bottle.color !== filters.color) {
      return false;
    }
    if (filters.crateId !== undefined && crate.id !== filters.crateId) {
      return false;
    }
    if (
      filters.vintageFrom !== undefined &&
      (bottle.vintage === null || bottle.vintage < filters.vintageFrom)
    ) {
      return false;
    }
    if (filters.vintageTo !== undefined && (bottle.vintage === null || bottle.vintage > filters.vintageTo)) {
      return false;
    }
    if (
      region !== null &&
      !normalizeForSearch(`${bottle.region ?? ''} ${bottle.subRegion ?? ''}`).includes(region)
    ) {
      return false;
    }
    if (
      filters.gardeStatus !== undefined &&
      computeGardeStatus({ drinkFrom: bottle.drinkFrom, drinkUntil: bottle.drinkUntil, currentYear }) !==
        filters.gardeStatus
    ) {
      return false;
    }
    if (words.length > 0) {
      const text = searchableText(row);
      return words.every((word) => text.includes(word));
    }
    return true;
  });
};
