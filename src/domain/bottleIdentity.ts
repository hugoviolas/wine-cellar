import type { BottleIdentityFields } from './interfaces/bottle-identity-fields.interface';

export type { BottleIdentityFields };

/**
 * Format retenu quand le volume n'est pas renseigné : le champ est
 * facultatif à la saisie, et une bouteille sans volume est dans
 * l'immense majorité des cas une 75 cl. Sans cette équivalence, la même
 * cuvée saisie une fois avec « 750 » et une fois sans ne serait jamais
 * reconnue comme identique. Un magnum, lui, a toujours son volume saisi.
 */
const STANDARD_VOLUME_ML = 750;

/**
 * Forme comparable d'un texte libre : sans casse, sans accents, sans
 * ponctuation ni espaces superflus. « Château Saint-Pierre » et
 * « chateau saint pierre » sont le même vin ; « St-Pierre » ne l'est pas
 * (pas de développement d'abréviations, trop risqué).
 */
const normalizeText = (value: string | null): string => {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
};

/**
 * Clé d'identité d'un vin : deux bouteilles de même clé sont le même vin,
 * et peuvent être regroupées (fusion au déplacement, liste des vins).
 *
 * Volontairement stricte : producteur, couleur ou millésime renseignés
 * d'un côté et pas de l'autre donnent deux vins différents. Fusionner à
 * tort mélange deux fiches, alors qu'un doublon se corrige d'un geste.
 */
export const bottleIdentityKey = (bottle: BottleIdentityFields): string => {
  return JSON.stringify([
    bottle.category,
    normalizeText(bottle.name),
    normalizeText(bottle.producer),
    bottle.vintage,
    normalizeText(bottle.color),
    bottle.volumeMl ?? STANDARD_VOLUME_ML,
  ]);
};

export const isSameWine = (a: BottleIdentityFields, b: BottleIdentityFields): boolean => {
  return bottleIdentityKey(a) === bottleIdentityKey(b);
};

/**
 * Regroupe les bouteilles d'un même vin, dans l'ordre de première
 * apparition — l'ordre d'entrée est conservé à l'intérieur de chaque
 * groupe.
 */
export const groupSameWines = <T extends BottleIdentityFields>(items: readonly T[]): T[][] => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = bottleIdentityKey(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return [...groups.values()];
};
