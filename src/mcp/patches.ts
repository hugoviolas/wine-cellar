import type { UpdateBottleInput } from '@/domain/bottles';
import type { UpdateWishlistItemInput } from '@/domain/wishlist';
import { buildDetails, checkColor } from './details';
import { ToolError } from './toolResult';
import type { BuildPatchArgs } from './interfaces/build-patch-args.interface';
import type { BuildBottlePatchArgs } from './interfaces/build-bottle-patch-args.interface';
import type { CheckDrinkWindowArgs } from './interfaces/check-drink-window-args.interface';
import type { DescriptionPatch } from './interfaces/description-patch.interface';
import type { DescriptionPatchInput } from './interfaces/description-patch-input.interface';
import type { WishlistPatchInput } from './interfaces/wishlist-patch-input.interface';

/**
 * Traduction des champs d'un tool de modification en patch du domaine.
 *
 * Seuls les champs envoyés y figurent, jamais une clé à `undefined` : les
 * fonctions de mise à jour recalculent la géographie dès qu'une clé
 * `region`, `subRegion` ou `details` est *présente*, et le contrôle de rôle
 * d'une bouteille se fait sur la liste des clés.
 */
const buildDescriptionPatch = ({
  target,
  input,
}: BuildPatchArgs<DescriptionPatchInput>): DescriptionPatch => {
  checkColor({ category: target.category, color: input.color });
  const patch: DescriptionPatch = {};
  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.producer !== undefined) {
    patch.producer = input.producer;
  }
  if (input.vintage !== undefined) {
    patch.vintage = input.vintage;
  }
  if (input.region !== undefined) {
    patch.region = input.region;
  }
  if (input.sub_region !== undefined) {
    patch.subRegion = input.sub_region;
  }
  if (input.color !== undefined) {
    patch.color = input.color;
  }
  if (input.abv !== undefined) {
    patch.abv = input.abv;
  }
  if (input.volume_ml !== undefined) {
    patch.volumeMl = input.volume_ml;
  }
  const touchesDetails =
    input.appellation !== undefined ||
    input.classification !== undefined ||
    input.grape_varieties !== undefined;
  if (touchesDetails) {
    patch.details = buildDetails({ category: target.category, current: target.details, input });
  }
  return patch;
};

export const buildBottlePatch = ({ target, input }: BuildBottlePatchArgs): UpdateBottleInput => {
  const patch: UpdateBottleInput = buildDescriptionPatch({ target, input });
  if (input.quantity !== undefined) {
    patch.quantity = input.quantity;
  }
  if (input.drink_from !== undefined) {
    patch.drinkFrom = input.drink_from;
  }
  if (input.drink_until !== undefined) {
    patch.drinkUntil = input.drink_until;
  }
  if (input.user_note !== undefined) {
    patch.userNote = input.user_note;
  }
  if (input.rating !== undefined) {
    patch.rating = input.rating;
  }
  if (input.crate_id !== undefined) {
    patch.crateId = input.crate_id;
  }
  checkDrinkWindow({
    drinkFrom: 'drinkFrom' in patch ? patch.drinkFrom : target.drinkFrom,
    drinkUntil: 'drinkUntil' in patch ? patch.drinkUntil : target.drinkUntil,
  });
  return patch;
};

export const buildWishlistPatch = ({
  target,
  input,
}: BuildPatchArgs<WishlistPatchInput>): UpdateWishlistItemInput => {
  const patch: UpdateWishlistItemInput = buildDescriptionPatch({ target, input });
  if (input.comment !== undefined) {
    patch.comment = input.comment;
  }
  return patch;
};

/** Une fenêtre de garde qui finit avant de commencer est une erreur de saisie. */
export const checkDrinkWindow = ({ drinkFrom, drinkUntil }: CheckDrinkWindowArgs): void => {
  if (typeof drinkFrom === 'number' && typeof drinkUntil === 'number' && drinkFrom > drinkUntil) {
    throw new ToolError('Fenêtre de garde incohérente : drink_from est postérieur à drink_until.');
  }
};
