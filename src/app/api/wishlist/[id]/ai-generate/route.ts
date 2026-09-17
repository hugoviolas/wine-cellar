import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { resolveWishlistItemAccess } from '@/domain/wishlist';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { buildBottleAnalysisPrompt } from '@/domain/ai/bottleAnalysis';
import { saveWishlistAiAnalysis, toBottleAnalysisInput } from '@/domain/ai/wishlistAnalysis';
import { getGrapeVarieties, getAppellation } from '@/domain/bottleCategories';
import { aiBottleAnalysisSchema } from '@/domain/ai/schemas';
import { callAiForRoute } from '@/domain/ai/callForRoute';
import { checkAiQuota } from '@/domain/ai/quota';

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  // Accès strictement privé, sans passe-droit super-admin : la wishlist est
  // une donnée personnelle (voir resolveWishlistItemAccess).
  const access = await resolveWishlistItemAccess({ db, userId: auth.user.id, itemId: id });
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const item = access.item;

  // Un item de wishlist n'appartient à aucune cave : le coupe-circuit IA se
  // joue donc à la maille utilisateur, comme pour l'extraction par photo.
  if (!(await isAiAvailableForUser({ db, userId: auth.user.id }))) {
    return NextResponse.json({ error: 'Fonction IA indisponible.' }, { status: 403 });
  }

  const category = item.category;
  const quotaExceeded = checkAiQuota({
    userId: auth.user.id,
    isSuperAdmin: auth.user.isSuperAdmin,
  });
  if (quotaExceeded) {
    return quotaExceeded;
  }

  const { system, content } = buildBottleAnalysisPrompt({
    bottle: toBottleAnalysisInput({
      name: item.name,
      producer: item.producer,
      vintage: item.vintage,
      category: item.category,
      region: item.region,
      subRegion: item.subRegion,
      color: item.color,
      grapeVarieties: getGrapeVarieties({ category, details: item.details }),
      appellation: getAppellation({ category, details: item.details }),
    }),
    currentYear: new Date().getFullYear(),
  });

  const result = await callAiForRoute({
    route: 'wishlist/ai-generate',
    system,
    content,
    schema: aiBottleAnalysisSchema,
    invalidResponseMessage: 'Réponse IA invalide, réessaie.',
  });
  if ('error' in result) {
    return result.error;
  }

  await saveWishlistAiAnalysis({
    db,
    item: {
      id: item.id,
      category,
      drinkFrom: item.drinkFrom,
      drinkUntil: item.drinkUntil,
      region: item.region,
      subRegion: item.subRegion,
      details: item.details,
    },
    analysis: result.data,
  });
  return NextResponse.json({ ok: true });
};
