import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { extractFromPhotoRequestSchema, aiPhotoExtractionSchema } from '@/domain/ai/schemas';
import { buildPhotoExtractionPrompt } from '@/domain/ai/photoExtraction';
import { callClaudeForJson, AiResponseError } from '@/domain/ai/client';

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = extractFromPhotoRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const { cellarId, imageBase64, mediaType } = parsed.data;

  const access = await checkCellarAccess(db, auth.user.id, cellarId);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const cellar = await getCellarById(db, cellarId);
  if (!cellar || !isAiAvailable(cellar)) {
    return NextResponse.json({ error: 'Fonction IA indisponible pour cette cave.' }, { status: 403 });
  }

  const { system, content } = buildPhotoExtractionPrompt(imageBase64, mediaType);
  try {
    const extracted = await callClaudeForJson({ system, content, schema: aiPhotoExtractionSchema });
    return NextResponse.json(extracted);
  } catch (err) {
    if (err instanceof AiResponseError) {
      return NextResponse.json({ error: 'Réponse IA invalide, réessaie avec une autre photo.' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 });
  }
}
