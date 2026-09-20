import { z } from 'zod';
import { FIELD_MAX } from '../fieldLimits';

/**
 * Les champs que le modèle peut remplir atterrissent dans les mêmes
 * colonnes que la saisie manuelle : ils suivent donc les mêmes bornes,
 * sans quoi une génération pourrait écrire une région de 400 caractères là
 * où un utilisateur en a 200 au maximum.
 *
 * `analysis` et `tastingAdvice` échappent à cette règle : ce sont des
 * textes rédigés, déjà bornés par le `max_tokens` de l'appel (voir
 * domain/ai/client.ts), et leur imposer une limite ferait échouer toute la
 * génération sur une réponse un peu longue mais parfaitement valable.
 */
const aiShortText = (): z.ZodString => {
  return z.string().min(1).max(FIELD_MAX.shortText);
};

/**
 * Source citée à l'appui d'une estimation de prix : le libellé du site et
 * l'URL consultée, pour que l'estimation soit vérifiable plutôt que d'être
 * à croire sur parole.
 *
 * Le protocole est contraint à http/https : l'URL vient du modèle et
 * atterrit dans un `href` de la fiche bouteille — un `javascript:` s'y
 * exécuterait au clic.
 */
const aiPriceSourceSchema = z.object({
  label: aiShortText(),
  url: z
    .string()
    .url()
    .max(FIELD_MAX.shortText)
    .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'URL de source non http(s)',
    }),
});
export type AiPriceSource = z.infer<typeof aiPriceSourceSchema>;

/**
 * Estimation de prix, toujours accompagnée de ses sources : au moins deux,
 * sans quoi ce n'est plus une estimation recoupée mais une valeur isolée.
 * Une fourchette plutôt qu'un prix unique — le marché d'une bouteille
 * n'est jamais un point, et une fourchette dit honnêtement la dispersion
 * constatée.
 *
 * Le modèle renvoie `null` quand il ne trouve pas : c'est le cas nominal,
 * pas un échec (voir `buildBottleAnalysisPrompt`). Inventer un prix
 * plausible serait pire que de ne rien afficher.
 */
export const aiPriceEstimateSchema = z
  .object({
    lowEur: z.number().positive(),
    highEur: z.number().positive(),
    /** Ce que la fourchette couvre : format, millésime réellement trouvé, marché... */
    note: z.string().max(FIELD_MAX.longText).nullable(),
    sources: z.array(aiPriceSourceSchema).min(2).max(5),
  })
  .refine((price) => price.lowEur <= price.highEur, {
    message: 'Fourchette de prix inversée',
  });
export type AiPriceEstimate = z.infer<typeof aiPriceEstimateSchema>;

/** Réponse attendue de Claude pour la fiche IA à la demande (chantier A). */
export const aiBottleAnalysisSchema = z.object({
  analysis: z.string().min(1),
  pairings: z.array(z.string().min(1)).min(3).max(5),
  tastingAdvice: z.string().min(1),
  drinkFromYear: z.number().int().nullable(),
  drinkUntilYear: z.number().int().nullable(),
  region: aiShortText().nullable(),
  subRegion: aiShortText().nullable(),
  grapeVarieties: z.array(aiShortText()).max(FIELD_MAX.listItems).nullable(),
  appellation: aiShortText().nullable(),
  /**
   * Absent des prompts qui ne demandent pas de prix (wishlist), d'où le
   * `nullish`. Le `catch` est délibéré : une estimation malformée dégrade
   * en « prix non trouvé » au lieu de faire échouer toute l'analyse — le
   * prix est un bonus de la génération, l'analyse en est le cœur.
   */
  priceEstimate: aiPriceEstimateSchema.nullish().catch(null),
});
export type AiBottleAnalysis = z.infer<typeof aiBottleAnalysisSchema>;

/** Réponse attendue de Claude pour l'extraction par photo (chantier B). */
export const aiPhotoExtractionSchema = z.object({
  name: aiShortText().nullable(),
  producer: aiShortText().nullable(),
  vintage: z.number().int().nullable(),
  category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']).nullable(),
  color: z.enum(['rouge', 'blanc', 'rose', 'autre']).nullable(),
  region: aiShortText().nullable(),
  subRegion: aiShortText().nullable(),
  grapeVarieties: z.array(aiShortText()).max(FIELD_MAX.listItems).nullable(),
  appellation: aiShortText().nullable(),
});
export type AiPhotoExtraction = z.infer<typeof aiPhotoExtractionSchema>;

/** Types MIME d'image acceptés par la vision Claude, pour le chantier B. */
export const aiImageMediaTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
export type AiImageMediaType = z.infer<typeof aiImageMediaTypeSchema>;

/** Corps de `POST /api/bottles/extract-from-photo` — la requête du client, pas la réponse de Claude. */
export const extractFromPhotoRequestSchema = z
  .object({
    cellarId: z.string().min(1),
    // 7 000 000 ≈ 5 Mo (limite client, voir MAX_BYTES dans PhotoFillButton.tsx) × 4/3
    // pour l'inflation du base64, arrondi légèrement au-dessus.
    imageBase64: z.string().min(1).max(7_000_000),
    mediaType: aiImageMediaTypeSchema,
  })
  .strict();
export type ExtractFromPhotoRequest = z.infer<typeof extractFromPhotoRequestSchema>;

/** Corps de `POST /api/wishlist/extract-from-photo` — pas de cellarId, la wishlist n'appartient à aucune cave. */
export const wishlistExtractFromPhotoRequestSchema = z
  .object({
    imageBase64: z.string().min(1).max(7_000_000),
    mediaType: aiImageMediaTypeSchema,
  })
  .strict();
export type WishlistExtractFromPhotoRequest = z.infer<typeof wishlistExtractFromPhotoRequestSchema>;
