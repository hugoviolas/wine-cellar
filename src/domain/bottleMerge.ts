import { parseBottleDetails } from './bottleCategories';
import type { BottleRow } from '../db/rows';
import type { BuildLotMergePatchArgs } from './interfaces/build-lot-merge-patch-args.interface';

export type LotMergePatch = Partial<
  Pick<
    BottleRow,
    | 'userNote'
    | 'rating'
    | 'drinkFrom'
    | 'drinkUntil'
    | 'aiAnalysis'
    | 'aiPairings'
    | 'aiTastingAdvice'
    | 'aiGeneratedAt'
    | 'region'
    | 'subRegion'
    | 'abv'
    | 'details'
    | 'createdAt'
  >
>;

const isBlank = (value: unknown): boolean => {
  return (
    value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
  );
};

/**
 * Note du lot fusionné. Une note absente est reprise ; deux notes
 * différentes ne sont mises bout à bout que si le lot d'origine disparaît
 * — tant qu'il reste des bouteilles de l'autre côté, il garde sa propre
 * note et la recopier ferait doublon.
 */
const mergedNote = ({ target, source, absorbsSource }: BuildLotMergePatchArgs): string | undefined => {
  const targetNote = target.userNote?.trim() ?? '';
  const sourceNote = source.userNote?.trim() ?? '';
  if (!sourceNote) {
    return undefined;
  }
  if (!targetNote) {
    return sourceNote;
  }
  if (absorbsSource && !targetNote.includes(sourceNote)) {
    return `${targetNote}\n\n${sourceNote}`;
  }
  return undefined;
};

/**
 * Détails de catégorie (cépages, appellation...) complétés clé par clé :
 * une clé vide côté cible prend la valeur de la source. `undefined` si rien
 * ne change, ou si l'un des deux JSON n'a pas la forme attendue — on garde
 * alors la cible telle quelle plutôt que de risquer d'écrire un mélange
 * invalide.
 */
const mergedDetails = ({ target, source }: BuildLotMergePatchArgs): unknown => {
  try {
    const targetDetails = parseBottleDetails(target.category, target.details);
    const sourceDetails = parseBottleDetails(source.category, source.details);
    const merged: Record<string, unknown> = { ...targetDetails };
    let changed = false;
    for (const key of Object.keys(sourceDetails)) {
      const sourceValue: unknown = Reflect.get(sourceDetails, key);
      if (isBlank(merged[key]) && !isBlank(sourceValue)) {
        merged[key] = sourceValue;
        changed = true;
      }
    }
    return changed ? parseBottleDetails(target.category, merged) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Champs à écrire sur le lot d'arrivée quand des bouteilles du même vin le
 * rejoignent (voir `moveBottles`). La quantité est gérée à part.
 *
 * Principe : le lot d'arrivée garde ce qu'il sait, et comble ses vides
 * avec ce que sait le lot rejoint — rien de ce qui a été saisi n'est
 * écrasé, et rien n'est perdu quand le lot rejoint disparaît.
 *
 * - Note : reprise si absente, mise à la suite si différente et que le lot
 *   d'origine disparaît.
 * - Note sur 5, fenêtre de garde, degré, région, détails : repris s'ils
 *   manquent.
 * - Analyse IA : la plus récente des deux, d'un bloc (une analyse est
 *   régénérable, pas personnelle).
 * - Date d'entrée en cave : la plus ancienne.
 */
export const buildLotMergePatch = (args: BuildLotMergePatchArgs): LotMergePatch => {
  const { target, source } = args;
  const patch: LotMergePatch = {};

  const note = mergedNote(args);
  if (note !== undefined) {
    patch.userNote = note;
  }
  if (target.rating === null && source.rating !== null) {
    patch.rating = source.rating;
  }
  if (target.drinkFrom === null && source.drinkFrom !== null) {
    patch.drinkFrom = source.drinkFrom;
  }
  if (target.drinkUntil === null && source.drinkUntil !== null) {
    patch.drinkUntil = source.drinkUntil;
  }
  if (target.abv === null && source.abv !== null) {
    patch.abv = source.abv;
  }
  // Région et sous-région vont ensemble : elles sont résolues d'un bloc à
  // la saisie (voir resolveWineGeography), les mélanger donnerait une
  // sous-région orpheline de sa région.
  if (target.region === null && source.region !== null) {
    patch.region = source.region;
    patch.subRegion = source.subRegion;
  }
  if (
    source.aiGeneratedAt !== null &&
    (target.aiGeneratedAt === null || source.aiGeneratedAt > target.aiGeneratedAt)
  ) {
    patch.aiAnalysis = source.aiAnalysis;
    patch.aiPairings = source.aiPairings;
    patch.aiTastingAdvice = source.aiTastingAdvice;
    patch.aiGeneratedAt = source.aiGeneratedAt;
  }
  const details = mergedDetails(args);
  if (details !== undefined) {
    patch.details = details;
  }
  if (source.createdAt < target.createdAt) {
    patch.createdAt = source.createdAt;
  }

  return patch;
};
