import { parseBottleDetails, getAppellation } from '../bottleCategories';
import { resolveWineGeography } from '../wineGeography';
import type { AiAnalysisPatch } from './interfaces/ai-analysis-patch.interface';
import type { BuildAiAnalysisPatchArgs } from './interfaces/build-ai-analysis-patch-args.interface';
import type { MergedDetailsArgs } from './interfaces/merged-details-args.interface';

/**
 * Champs à écrire après une génération IA, pour une bouteille comme pour un
 * item de wishlist — les deux suivent exactement les mêmes règles, et les
 * avaient jusqu'ici recopiées ligne pour ligne chacun de leur côté.
 *
 * Les quatre champs `ai*` sont toujours réécrits, y compris à une
 * régénération. `drinkFrom`, les cépages et l'appellation ne sont remplis
 * que s'ils sont vides : ce qui a été saisi à la main, extrait d'une photo
 * ou produit par une génération précédente n'est jamais écrasé.
 *
 * `region` et `subRegion` font exception. Ils ne sont pas « remplis » mais
 * *résolus* : la géographie canonique se déduit de l'appellation effective
 * (voir `resolveWineGeography`), donc une génération qui apporte enfin
 * l'appellation doit pouvoir recaler une région saisie trop fine — un
 * Saint-Julien rangé en « Haut-Médoc » devient Bordeaux / Haut-Médoc. Le
 * résolveur étant idempotent, une géographie déjà correcte est réécrite à
 * l'identique plutôt que d'être laissée incohérente.
 */
export const buildAiAnalysisPatch = ({ target, analysis }: BuildAiAnalysisPatchArgs): AiAnalysisPatch => {
  const patch: AiAnalysisPatch = {
    aiAnalysis: analysis.analysis,
    aiPairings: analysis.pairings,
    aiTastingAdvice: analysis.tastingAdvice,
    aiGeneratedAt: new Date().toISOString(),
  };

  if (target.drinkFrom === null && analysis.drinkFromYear !== null) {
    patch.drinkFrom = analysis.drinkFromYear;
  }
  if (target.drinkUntil === null && analysis.drinkUntilYear !== null) {
    patch.drinkUntil = analysis.drinkUntilYear;
  }

  const details = mergedDetails({ target, analysis });
  if (details !== null) {
    patch.details = details;
  }

  // La géographie se résout sur l'état d'après : l'appellation fraîchement
  // fusionnée est justement celle qui permet de trancher la région.
  const effectiveDetails = details ?? target.details;
  const geography = resolveWineGeography({
    region: target.region ?? analysis.region,
    subRegion: target.subRegion ?? analysis.subRegion,
    appellation: getAppellation({ category: target.category, details: effectiveDetails }),
  });
  patch.region = geography.region;
  patch.subRegion = geography.subRegion;

  return patch;
};

/**
 * Détails enrichis des cépages et de l'appellation devinés, ou `null` si
 * rien n'a changé — seules les catégories `wine` et `sparkling` portent ces
 * champs.
 */
const mergedDetails = ({ target, analysis }: MergedDetailsArgs): unknown => {
  if (target.category !== 'wine' && target.category !== 'sparkling') {
    return null;
  }

  const current = parseBottleDetails(target.category, target.details);
  let changed = false;
  let details: { grapeVarieties: string[]; appellation?: string } = { ...current };

  if (details.grapeVarieties.length === 0 && analysis.grapeVarieties?.length) {
    details = { ...details, grapeVarieties: analysis.grapeVarieties };
    changed = true;
  }
  // `appellation` n'existe que pour `wine` : pour un effervescent, le champ
  // est absent du schéma et l'écrire n'aurait aucun sens.
  if (target.category === 'wine' && !details.appellation && analysis.appellation) {
    details = { ...details, appellation: analysis.appellation };
    changed = true;
  }

  return changed ? details : null;
};
