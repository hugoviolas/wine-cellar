import { z } from 'zod';
import { FIELD_MAX } from './fieldLimits';
import type { GetGrapeVarietiesArgs } from './interfaces/get-grape-varieties-args.interface';
import type { GetAppellationArgs } from './interfaces/get-appellation-args.interface';
import type { GetClassificationArgs } from './interfaces/get-classification-args.interface';

/**
 * Champ libre d'une fiche détail : borné comme partout ailleurs (voir
 * fieldLimits.ts). Ces schémas alimentent une colonne JSON, donc rien côté
 * base ne viendrait limiter ce qu'on y écrit.
 */
const shortText = (): z.ZodString => {
  return z.string().max(FIELD_MAX.shortText);
};

/** Liste libre : bornée en nombre d'entrées autant qu'en longueur de chacune. */
const shortTextList = (): z.ZodDefault<z.ZodArray<z.ZodString>> => {
  return z.array(shortText()).max(FIELD_MAX.listItems).default([]);
};

/**
 * Règle d'or de ce fichier : **toute clé déclarée ici doit avoir un champ de
 * saisie correspondant dans les formulaires**, parce que `details` est
 * remplacé en entier à chaque édition (voir `buildBottleDetails` dans
 * lib/bottleDetails.ts et le PATCH de `api/bottles/[id]`). Une clé sans
 * input serait effacée à la première modification de la bouteille.
 *
 * Les catégories hors vin n'ont volontairement aucun champ spécifique :
 * elles servent à ranger une bouteille, pas à la détailler. `details` reste
 * une colonne JSON, donc leur en rajouter plus tard ne coûtera aucune
 * migration — seulement les inputs qui vont avec.
 */
export const wineDetailsSchema = z.object({
  grapeVarieties: shortTextList(),
  appellation: shortText().optional(),
  classification: shortText().optional(),
});

export const sparklingDetailsSchema = z.object({
  grapeVarieties: shortTextList(),
});

export const ciderDetailsSchema = z.object({});

export const beerDetailsSchema = z.object({});

export const spiritDetailsSchema = z.object({});

export const detailsSchemaByCategory = {
  wine: wineDetailsSchema,
  sparkling: sparklingDetailsSchema,
  cider: ciderDetailsSchema,
  beer: beerDetailsSchema,
  spirit: spiritDetailsSchema,
} as const;

export type BottleCategory = keyof typeof detailsSchemaByCategory;

export const parseBottleDetails = <C extends BottleCategory>(
  category: C,
  details: unknown,
): z.infer<(typeof detailsSchemaByCategory)[C]> => {
  return detailsSchemaByCategory[category].parse(details) as z.infer<(typeof detailsSchemaByCategory)[C]>;
};

/** `grapeVarieties` n'existe que pour wine et sparkling — [] pour les autres catégories. */
export const getGrapeVarieties = ({ category, details }: GetGrapeVarietiesArgs): string[] => {
  if (category !== 'wine' && category !== 'sparkling') {
    return [];
  }
  return parseBottleDetails(category, details).grapeVarieties;
};

/** `appellation` n'existe que pour wine — null pour les autres catégories. */
export const getAppellation = ({ category, details }: GetAppellationArgs): string | null => {
  if (category !== 'wine') {
    return null;
  }
  return parseBottleDetails('wine', details).appellation ?? null;
};

/** `classification` (Grand Cru, Premier Cru...) n'existe que pour wine. */
export const getClassification = ({ category, details }: GetClassificationArgs): string | null => {
  if (category !== 'wine') {
    return null;
  }
  return parseBottleDetails('wine', details).classification ?? null;
};
