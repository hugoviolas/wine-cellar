import { getAppellation, getClassification, getGrapeVarieties } from '@/domain/bottleCategories';
import { computeGardeStatus } from '@/domain/gardeStatus';
import type { CrateRow, WishlistItemRow } from '@/db/rows';
import { crateLabel } from '@/lib/crateLabel';
import type { CrateRefView } from './interfaces/crate-ref-view.interface';
import type { BottleSummaryView } from './interfaces/bottle-summary-view.interface';
import type { BottleDetailView } from './interfaces/bottle-detail-view.interface';
import type { ConsumptionView } from './interfaces/consumption-view.interface';
import type { WishlistItemView } from './interfaces/wishlist-item-view.interface';
import type { PresentBottleArgs } from './interfaces/present-bottle-args.interface';
import type { PresentBottleDetailArgs } from './interfaces/present-bottle-detail-args.interface';
import type { PresentConsumptionArgs } from './interfaces/present-consumption-args.interface';

/**
 * Forme des réponses des tools : snake_case comme les paramètres d'entrée,
 * et seulement ce qui sert à Claude — pas d'ordre d'affichage, pas de
 * colonnes techniques.
 */

export const presentCrateRef = (crate: CrateRow): CrateRefView => {
  return { crate_id: crate.id, label: crateLabel({ number: crate.number, name: crate.name }) };
};

export const presentBottleSummary = ({
  bottle,
  crate,
  currentYear,
}: PresentBottleArgs): BottleSummaryView => {
  return {
    bottle_id: bottle.id,
    name: bottle.name,
    producer: bottle.producer,
    category: bottle.category,
    color: bottle.color,
    vintage: bottle.vintage,
    region: bottle.region,
    sub_region: bottle.subRegion,
    appellation: getAppellation({ category: bottle.category, details: bottle.details }),
    quantity: bottle.quantity,
    drink_from: bottle.drinkFrom,
    drink_until: bottle.drinkUntil,
    garde_status: computeGardeStatus({
      drinkFrom: bottle.drinkFrom,
      drinkUntil: bottle.drinkUntil,
      currentYear,
    }),
    rating: bottle.rating,
    crate: presentCrateRef(crate),
  };
};

export const presentBottleDetail = (args: PresentBottleDetailArgs): BottleDetailView => {
  const { bottle, crate, role, consumptions, userId } = args;
  const { category, details } = bottle;
  return {
    ...presentBottleSummary(args),
    cellar_id: crate.cellarId,
    role,
    classification: getClassification({ category, details }),
    grape_varieties: getGrapeVarieties({ category, details }),
    abv: bottle.abv,
    volume_ml: bottle.volumeMl,
    user_note: bottle.userNote,
    analysis: bottle.aiAnalysis,
    pairings: bottle.aiPairings,
    tasting_advice: bottle.aiTastingAdvice,
    analysis_generated_at: bottle.aiGeneratedAt,
    added_at: bottle.createdAt,
    ...(consumptions === undefined
      ? {}
      : {
          consumptions: consumptions.map((entry) =>
            presentConsumption({ entry, bottleReachable: true, userId }),
          ),
        }),
  };
};

export const presentConsumption = ({
  entry,
  bottleReachable,
  userId,
}: PresentConsumptionArgs): ConsumptionView => {
  return {
    entry_id: entry.id,
    bottle_id: bottleReachable ? entry.bottleId : null,
    consumed_at: entry.consumedAt,
    quantity: entry.quantity,
    rating: entry.rating,
    comment: entry.comment,
    occasion: entry.occasion,
    by_me: entry.consumedByUserId === userId,
    name: entry.bottleNameSnapshot,
    producer: entry.bottleProducerSnapshot,
    vintage: entry.bottleVintageSnapshot,
    category: entry.bottleCategorySnapshot,
  };
};

export const presentWishlistItem = (item: WishlistItemRow): WishlistItemView => {
  const { category, details } = item;
  return {
    item_id: item.id,
    status: item.status,
    promoted_bottle_id: item.promotedBottleId,
    name: item.name,
    producer: item.producer,
    category,
    color: item.color,
    vintage: item.vintage,
    region: item.region,
    sub_region: item.subRegion,
    appellation: getAppellation({ category, details }),
    classification: getClassification({ category, details }),
    grape_varieties: getGrapeVarieties({ category, details }),
    abv: item.abv,
    volume_ml: item.volumeMl,
    comment: item.comment,
    drink_from: item.drinkFrom,
    drink_until: item.drinkUntil,
    added_at: item.createdAt,
  };
};
