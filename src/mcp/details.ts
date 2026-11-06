import { parseBottleDetails } from '@/domain/bottleCategories';
import { ToolError } from './toolResult';
import type { BuildDetailsArgs } from './interfaces/build-details-args.interface';
import type { CheckColorArgs } from './interfaces/check-color-args.interface';
import type { ApplyTextArgs } from './interfaces/apply-text-args.interface';

/**
 * Détails propres à la catégorie (`bottles.details`), à partir de ceux déjà
 * stockés et des champs envoyés par Claude. Contrairement aux formulaires
 * de l'app, qui renvoient toujours l'objet complet, un tool ne reçoit que
 * ce qui change : on fusionne, puis on valide comme partout ailleurs avec
 * `parseBottleDetails`.
 *
 * Un champ qui n'existe pas pour la catégorie est refusé avec un message
 * explicite plutôt qu'ignoré : une appellation donnée pour une bière serait
 * sinon perdue sans que personne ne le sache.
 */
export const buildDetails = ({ category, current, input }: BuildDetailsArgs): unknown => {
  const isWine = category === 'wine';
  const hasGrapes = isWine || category === 'sparkling';
  if (!isWine && (isSet(input.appellation) || isSet(input.classification))) {
    throw new ToolError(
      'appellation et classification ne concernent que les vins tranquilles (category wine).',
    );
  }
  if (!hasGrapes && (input.grape_varieties?.length ?? 0) > 0) {
    throw new ToolError('grape_varieties ne concerne que wine et sparkling.');
  }

  const base: Record<string, unknown> = {};
  if (typeof current === 'object' && current !== null) {
    Object.assign(base, current);
  }
  if (isWine) {
    applyText({ target: base, key: 'appellation', value: input.appellation });
    applyText({ target: base, key: 'classification', value: input.classification });
  }
  if (hasGrapes && input.grape_varieties !== undefined) {
    base.grapeVarieties = input.grape_varieties ?? [];
  }

  try {
    return parseBottleDetails(category, base);
  } catch {
    throw new ToolError('Détails invalides pour cette catégorie.');
  }
};

/** La couleur n'a de sens que pour un vin ou un effervescent, comme dans les formulaires. */
export const checkColor = ({ category, color }: CheckColorArgs): void => {
  if (isSet(color) && category !== 'wine' && category !== 'sparkling') {
    throw new ToolError('color ne concerne que wine et sparkling.');
  }
};

const isSet = (value: string | null | undefined): boolean => {
  return value !== undefined && value !== null;
};

/** Absent : inchangé ; `null` : la clé est retirée ; sinon remplacée. */
const applyText = ({ target, key, value }: ApplyTextArgs): void => {
  if (value === null) {
    delete target[key];
  } else if (value !== undefined) {
    target[key] = value;
  }
};
