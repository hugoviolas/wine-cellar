import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import {
  buildBottleAnalysisPrompt,
  saveBottleAiAnalysis,
  type BottleAnalysisInput,
} from '@/domain/ai/bottleAnalysis';
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

  const bottleForPrompt: BottleAnalysisInput = {
    name: access.bottle.name,
    producer: access.bottle.producer,
    vintage: access.bottle.vintage,
    category: access.bottle.category,
    region: access.bottle.region,
    color: access.bottle.color,
    grapeVarieties: getGrapeVarieties({ category: access.bottle.category, details: access.bottle.details }),
    appellation: getAppellation({ category: access.bottle.category, details: access.bottle.details }),
  };
  const quotaExceeded = checkAiQuota({
    userId: auth.user.id,
    isSuperAdmin: auth.user.isSuperAdmin,
  });
  if (quotaExceeded) {
    return quotaExceeded;
  }

  const { system, content } = buildBottleAnalysisPrompt({
    bottle: bottleForPrompt,
    currentYear: new Date().getFullYear(),
  });

  const result = await callAiForRoute({
    route: 'bottles/ai-generate',
    system,
    content,
    schema: aiBottleAnalysisSchema,
    invalidResponseMessage: 'Réponse IA invalide, réessaie.',
  });
  if ('error' in result) {
    return result.error;
  }

  await saveBottleAiAnalysis({ db, bottle: access.bottle, analysis: result.data });
  return NextResponse.json({ ok: true });
};
