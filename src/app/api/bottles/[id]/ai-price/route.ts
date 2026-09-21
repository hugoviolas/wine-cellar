import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { buildBottlePricePrompt, saveBottlePriceEstimate } from '@/domain/ai/bottlePrice';
import { getGrapeVarieties, getAppellation } from '@/domain/bottleCategories';
import { aiBottlePriceSchema } from '@/domain/ai/schemas';
import { WEB_SEARCH_TOOL } from '@/domain/ai/client';
import { callAiForRoute } from '@/domain/ai/callForRoute';
import { checkAiQuota } from '@/domain/ai/quota';

/**
 * Estimation de prix, séparée de `ai-generate`.
 *
 * C'est la seule génération qui interroge la recherche web, donc la seule
 * qui se compte en dizaines de secondes plutôt qu'en secondes. La tenir à
 * part permet d'afficher l'analyse dès qu'elle est prête et de laisser le
 * prix arriver ensuite, au lieu de faire attendre les deux au rythme du
 * plus lent.
 *
 * Contrôles d'accès identiques à ceux de `ai-generate` : même ressource,
 * même écriture en base, donc mêmes conditions.
 */
export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const access = await resolveBottleAccess({ db, userId: auth.user.id, bottleId: id });
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const crate = await getCrateById({ db, crateId: access.bottle.crateId });
  const cellar = crate ? await getCellarById({ db, cellarId: crate.cellarId }) : null;
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

  const { system, content } = buildBottlePricePrompt({
    bottle: {
      name: access.bottle.name,
      producer: access.bottle.producer,
      vintage: access.bottle.vintage,
      category: access.bottle.category,
      region: access.bottle.region,
      subRegion: access.bottle.subRegion,
      color: access.bottle.color,
      grapeVarieties: getGrapeVarieties({ category: access.bottle.category, details: access.bottle.details }),
      appellation: getAppellation({ category: access.bottle.category, details: access.bottle.details }),
    },
  });

  // `maxTokens` reste modeste : le JSON attendu est court. Le budget de
  // temps, lui, est celui par défaut — c'est la recherche qui le consomme,
  // pas la rédaction.
  const result = await callAiForRoute({
    route: 'bottles/ai-price',
    system,
    content,
    schema: aiBottlePriceSchema,
    invalidResponseMessage: 'Réponse IA invalide, réessaie.',
    tools: [WEB_SEARCH_TOOL],
    maxTokens: 4096,
  });
  if ('error' in result) {
    return result.error;
  }

  await saveBottlePriceEstimate({ db, bottleId: access.bottle.id, estimate: result.data.priceEstimate });
  return NextResponse.json({ ok: true, found: result.data.priceEstimate !== null });
};
