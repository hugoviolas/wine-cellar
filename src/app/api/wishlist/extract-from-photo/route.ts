import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { wishlistExtractFromPhotoRequestSchema, aiPhotoExtractionSchema } from '@/domain/ai/schemas';
import { buildPhotoExtractionPrompt } from '@/domain/ai/photoExtraction';
import { callAiForRoute } from '@/domain/ai/callForRoute';
import { checkAiQuota } from '@/domain/ai/quota';
import { readJsonBody } from '@/lib/readJsonBody';

export const POST = async (request: Request): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }

  const rawBody = await readJsonBody(request);
  const parsed = wishlistExtractFromPhotoRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const { imageBase64, mediaType } = parsed.data;

  const available = await isAiAvailableForUser(db, auth.user.id);
  if (!available) {
    return NextResponse.json({ error: 'Fonction IA indisponible.' }, { status: 403 });
  }

  const quotaExceeded = checkAiQuota({
    userId: auth.user.id,
    isSuperAdmin: auth.user.isSuperAdmin,
  });
  if (quotaExceeded) {
    return quotaExceeded;
  }

  const { system, content } = buildPhotoExtractionPrompt(imageBase64, mediaType);
  const result = await callAiForRoute({
    route: 'wishlist/extract-from-photo',
    system,
    content,
    schema: aiPhotoExtractionSchema,
    invalidResponseMessage: 'Réponse IA invalide, réessaie avec une autre photo.',
  });
  if ('error' in result) {
    return result.error;
  }
  return NextResponse.json(result.data);
};
