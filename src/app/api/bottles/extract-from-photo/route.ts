import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { extractFromPhotoRequestSchema, aiPhotoExtractionSchema } from '@/domain/ai/schemas';
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
  const parsed = extractFromPhotoRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const { cellarId, imageBase64, mediaType } = parsed.data;

  const access = await checkCellarAccess({ db, userId: auth.user.id, cellarId });
  if (!access.allowed) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const cellar = await getCellarById({ db, cellarId });
  if (!cellar || !isAiAvailable(cellar)) {
    return NextResponse.json({ error: 'Fonction IA indisponible pour cette cave.' }, { status: 403 });
  }

  const quotaExceeded = checkAiQuota({
    userId: auth.user.id,
    isSuperAdmin: auth.user.isSuperAdmin,
  });
  if (quotaExceeded) {
    return quotaExceeded;
  }

  const { system, content } = buildPhotoExtractionPrompt({ imageBase64, mediaType });
  const result = await callAiForRoute({
    route: 'bottles/extract-from-photo',
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
