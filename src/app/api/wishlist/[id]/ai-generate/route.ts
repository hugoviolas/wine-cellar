import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { resolveWishlistItemAccess } from '@/domain/wishlist';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { buildBottleAnalysisPrompt } from '@/domain/ai/bottleAnalysis';
import { saveWishlistAiAnalysis, toBottleAnalysisInput } from '@/domain/ai/wishlistAnalysis';
import { getGrapeVarieties, getAppellation } from '@/domain/bottleCategories';
import type { BottleCategory } from '@/domain/bottleCategories';
import { aiBottleAnalysisSchema } from '@/domain/ai/schemas';
import { callClaudeForJson, AiResponseError } from '@/domain/ai/client';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  // Accès strictement privé, sans passe-droit super-admin : la wishlist est
  // une donnée personnelle (voir resolveWishlistItemAccess).
  const access = await resolveWishlistItemAccess(db, auth.user.id, id);
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const item = access.item;

  // Un item de wishlist n'appartient à aucune cave : le coupe-circuit IA se
  // joue donc à la maille utilisateur, comme pour l'extraction par photo.
  if (!(await isAiAvailableForUser(db, auth.user.id))) {
    return NextResponse.json({ error: 'Fonction IA indisponible.' }, { status: 403 });
  }

  const category = item.category as BottleCategory;
  const { system, content } = buildBottleAnalysisPrompt(
    toBottleAnalysisInput({
      name: item.name,
      producer: item.producer,
      vintage: item.vintage,
      category: item.category,
      region: item.region,
      color: item.color,
      grapeVarieties: getGrapeVarieties(category, item.details),
      appellation: getAppellation(category, item.details),
    }),
    new Date().getFullYear(),
  );

  let analysis;
  try {
    analysis = await callClaudeForJson({ system, content, schema: aiBottleAnalysisSchema });
  } catch (err) {
    if (err instanceof AiResponseError) {
      console.error('[wishlist/ai-generate]', err);
      return NextResponse.json({ error: 'Réponse IA invalide, réessaie.' }, { status: 502 });
    }
    console.error('[wishlist/ai-generate]', err);
    return NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 });
  }

  await saveWishlistAiAnalysis(
    db,
    {
      id: item.id,
      category,
      drinkFrom: item.drinkFrom,
      drinkUntil: item.drinkUntil,
      region: item.region,
      details: item.details,
    },
    analysis,
  );
  return NextResponse.json({ ok: true });
}
