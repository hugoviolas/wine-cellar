import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { wishlistExtractFromPhotoRequestSchema, aiPhotoExtractionSchema } from '@/domain/ai/schemas';
import { buildPhotoExtractionPrompt } from '@/domain/ai/photoExtraction';
import { callClaudeForJson, AiResponseError } from '@/domain/ai/client';

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = wishlistExtractFromPhotoRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const { imageBase64, mediaType } = parsed.data;

  const available = await isAiAvailableForUser(db, auth.user.id);
  if (!available) {
    return NextResponse.json({ error: 'Fonction IA indisponible.' }, { status: 403 });
  }

  const { system, content } = buildPhotoExtractionPrompt(imageBase64, mediaType);
  try {
    const extracted = await callClaudeForJson({ system, content, schema: aiPhotoExtractionSchema });
    return NextResponse.json(extracted);
  } catch (err) {
    if (err instanceof AiResponseError) {
      console.error('[wishlist/extract-from-photo]', err);
      return NextResponse.json({ error: 'Réponse IA invalide, réessaie avec une autre photo.' }, { status: 502 });
    }
    console.error('[wishlist/extract-from-photo]', err);
    return NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 });
  }
}
