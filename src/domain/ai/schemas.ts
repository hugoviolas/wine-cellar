import { z } from 'zod';

/** Réponse attendue de Claude pour la fiche IA à la demande (chantier A). */
export const aiBottleAnalysisSchema = z.object({
  analysis: z.string().min(1),
  pairings: z.array(z.string().min(1)).min(3).max(5),
  tastingAdvice: z.string().min(1),
  drinkFromYear: z.number().int().nullable(),
  drinkUntilYear: z.number().int().nullable(),
});
export type AiBottleAnalysis = z.infer<typeof aiBottleAnalysisSchema>;

/** Réponse attendue de Claude pour l'extraction par photo (chantier B). */
export const aiPhotoExtractionSchema = z.object({
  name: z.string().min(1).nullable(),
  producer: z.string().min(1).nullable(),
  vintage: z.number().int().nullable(),
  category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']).nullable(),
  color: z.enum(['rouge', 'blanc', 'rose', 'autre']).nullable(),
  region: z.string().min(1).nullable(),
});
export type AiPhotoExtraction = z.infer<typeof aiPhotoExtractionSchema>;

/** Types MIME d'image acceptés par la vision Claude, pour le chantier B. */
export const aiImageMediaTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
export type AiImageMediaType = z.infer<typeof aiImageMediaTypeSchema>;

/** Corps de `POST /api/bottles/extract-from-photo` — la requête du client, pas la réponse de Claude. */
export const extractFromPhotoRequestSchema = z
  .object({
    cellarId: z.string().min(1),
    imageBase64: z.string().min(1),
    mediaType: aiImageMediaTypeSchema,
  })
  .strict();
export type ExtractFromPhotoRequest = z.infer<typeof extractFromPhotoRequestSchema>;
