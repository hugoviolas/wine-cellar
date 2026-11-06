import { z } from 'zod';
import { FIELD_MAX } from '@/domain/fieldLimits';

/**
 * Champs d'entrée partagés par les tools. Leurs descriptions sont ce que
 * Claude lit pour remplir un appel : unités, valeurs admises et effet d'un
 * `null` y sont dits explicitement.
 */

const id = (what: string): z.ZodString => {
  return z.string().min(1).max(100).describe(what);
};

export const cellarIdField = id(
  "Identifiant de la cave (cellar_id, voir list_cellars). Par défaut : la cave principale de l'utilisateur.",
).optional();
export const bottleIdField = id('Identifiant de la bouteille (bottle_id, voir search_bottles).');
export const crateIdField = id('Identifiant de la clayette (crate_id, voir get_cellar_overview).');
export const entryIdField = id('Identifiant de la consommation (entry_id, voir list_consumptions).');
export const wishlistItemIdField = id("Identifiant de l'item de wishlist (item_id, voir list_wishlist).");

export const CATEGORIES = ['wine', 'sparkling', 'cider', 'beer', 'spirit'] as const;
export const COLORS = ['rouge', 'blanc', 'rose', 'autre'] as const;
export const GARDE_STATUSES = ['too_young', 'ready', 'closing_window', 'unknown'] as const;

export const categoryField = z
  .enum(CATEGORIES)
  .describe(
    'Catégorie : wine (vin tranquille), sparkling (champagne, crémant, autre effervescent), cider (cidre, poiré), beer (bière), spirit (spiritueux). Ne change plus après la création.',
  );

const shortText = (what: string): z.ZodString => {
  return z.string().trim().min(1).max(FIELD_MAX.shortText).describe(what);
};

const longText = (what: string): z.ZodString => {
  return z.string().trim().max(FIELD_MAX.longText).describe(what);
};

const year = (what: string): z.ZodNumber => {
  return z.number().int().min(1800).max(2200).describe(what);
};

export const ratingField = z.number().int().min(0).max(5).describe('Note de 0 à 5.');

/** Vrai pour une date qui existe au calendrier (pas de 31 février). */
const isCalendarDay = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDay, 'Date inexistante.')
  .describe('Jour au format AAAA-MM-JJ (heure de Paris).');

/**
 * Description d'une bouteille, commune à l'ajout en cave et à la wishlist.
 * L'appellation, la classification et les cépages sont rangés dans les
 * détails propres à la catégorie : appellation et classification pour les
 * vins (wine) seulement, cépages pour wine et sparkling.
 */
export const bottleDescriptionFields = {
  name: shortText('Nom de la bouteille, tel que sur l’étiquette (ex. « Château Gruaud-Larose »).'),
  producer: shortText('Producteur, domaine ou maison.'),
  vintage: year('Millésime (année).'),
  region: shortText(
    'Grande région (ex. « Bordeaux », « Vallée du Rhône », « Toscane »). Recalée automatiquement d’après l’appellation quand elle est connue.',
  ),
  sub_region: shortText(
    'Sous-région, entre la région et l’appellation (ex. « Haut-Médoc », « Côte de Nuits »).',
  ),
  color: z
    .enum(COLORS)
    .describe(
      'Couleur, pour wine et sparkling seulement : rouge, blanc, rose (rosé) ou autre (orange, jaune…).',
    ),
  abv: z.number().min(0).max(100).describe('Degré d’alcool, en % vol.'),
  volume_ml: z
    .number()
    .int()
    .positive()
    .max(30_000)
    .describe('Contenance en millilitres (750 pour une bouteille, 1500 pour un magnum).'),
  appellation: shortText('Appellation (AOC/AOP) exacte, pour wine seulement (ex. « Saint-Julien »).'),
  classification: shortText('Classement, pour wine seulement (ex. « Grand Cru Classé », « Premier Cru »).'),
  grape_varieties: z
    .array(shortText('Cépage'))
    .max(FIELD_MAX.listItems)
    .describe('Cépages, pour wine et sparkling seulement. Remplace la liste entière.'),
};

export const drinkWindowFields = {
  drink_from: year('Première année de la fenêtre de garde (à boire à partir de).'),
  drink_until: year('Dernière année de la fenêtre de garde (à boire jusqu’à).'),
};

export const userNoteField = longText('Note personnelle libre sur la bouteille.');
export const commentField = longText('Commentaire libre.');
export const occasionField = shortText('Occasion (ex. « anniversaire de Léa », « dîner du dimanche »).');

export const pageFields = {
  limit: z.number().int().min(1).max(200).optional().describe('Nombre maximal de résultats (50 par défaut).'),
  offset: z.number().int().min(0).optional().describe('Résultats à sauter, pour paginer (0 par défaut).'),
};

/** Pour un champ modifiable : absent = inchangé, null = effacé. */
export const clearable = <T extends z.ZodType>(field: T): z.ZodOptional<z.ZodNullable<T>> => {
  return field.nullable().optional();
};
