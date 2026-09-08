import { z } from 'zod';

export const wineDetailsSchema = z.object({
  grapeVarieties: z.array(z.string()).default([]),
  appellation: z.string().optional(),
  classification: z.string().optional(),
});

export const sparklingDetailsSchema = z.object({
  grapeVarieties: z.array(z.string()).default([]),
  dosage: z.string().optional(),
  method: z.string().optional(),
  disgorgementDate: z.string().optional(),
});

export const ciderDetailsSchema = z.object({
  appleVarieties: z.array(z.string()).default([]),
  method: z.enum(['bouche', 'fermier']).optional(),
  sweetness: z.enum(['doux', 'brut']).optional(),
});

export const beerDetailsSchema = z.object({
  style: z.string().optional(),
  ibu: z.number().optional(),
  ebc: z.number().optional(),
  fermentation: z.string().optional(),
});

export const spiritDetailsSchema = z.object({
  spiritType: z.string().optional(),
  cask: z.string().optional(),
  age: z.number().optional(),
  origin: z.string().optional(),
});

export const detailsSchemaByCategory = {
  wine: wineDetailsSchema,
  sparkling: sparklingDetailsSchema,
  cider: ciderDetailsSchema,
  beer: beerDetailsSchema,
  spirit: spiritDetailsSchema,
} as const;

export type BottleCategory = keyof typeof detailsSchemaByCategory;

export function parseBottleDetails<C extends BottleCategory>(
  category: C,
  details: unknown,
): z.infer<(typeof detailsSchemaByCategory)[C]> {
  return detailsSchemaByCategory[category].parse(details) as z.infer<(typeof detailsSchemaByCategory)[C]>;
}

/** `grapeVarieties` n'existe que pour wine et sparkling — [] pour les autres catégories. */
export function getGrapeVarieties(category: BottleCategory, details: unknown): string[] {
  if (category !== 'wine' && category !== 'sparkling') return [];
  return parseBottleDetails(category, details).grapeVarieties;
}

/** `appellation` n'existe que pour wine — null pour les autres catégories. */
export function getAppellation(category: BottleCategory, details: unknown): string | null {
  if (category !== 'wine') return null;
  return parseBottleDetails('wine', details).appellation ?? null;
}
