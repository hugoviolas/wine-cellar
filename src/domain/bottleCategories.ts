import { z } from 'zod';
import { FIELD_MAX } from './fieldLimits';
import type { GetGrapeVarietiesArgs } from './interfaces/get-grape-varieties-args.interface';
import type { GetAppellationArgs } from './interfaces/get-appellation-args.interface';

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

export const wineDetailsSchema = z.object({
  grapeVarieties: shortTextList(),
  appellation: shortText().optional(),
  classification: shortText().optional(),
});

export const sparklingDetailsSchema = z.object({
  grapeVarieties: shortTextList(),
  dosage: shortText().optional(),
  method: shortText().optional(),
  disgorgementDate: shortText().optional(),
});

export const ciderDetailsSchema = z.object({
  appleVarieties: shortTextList(),
  method: z.enum(['bouche', 'fermier']).optional(),
  sweetness: z.enum(['doux', 'brut']).optional(),
});

export const beerDetailsSchema = z.object({
  style: shortText().optional(),
  ibu: z.number().optional(),
  ebc: z.number().optional(),
  fermentation: shortText().optional(),
});

export const spiritDetailsSchema = z.object({
  spiritType: shortText().optional(),
  cask: shortText().optional(),
  age: z.number().optional(),
  origin: shortText().optional(),
});

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
