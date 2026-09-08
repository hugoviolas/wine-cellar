import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { buildBottleAnalysisPrompt, saveBottleAiAnalysis } from '@/domain/ai/bottleAnalysis';
import { aiBottleAnalysisSchema } from '@/domain/ai/schemas';
import { callClaudeForJson, AiResponseError } from '@/domain/ai/client';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const access = await resolveBottleAccess(db, auth.user.id, id);
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  // access.status === 'ok' garantit bottle.crateId non nul (voir bottleAccess.ts).
  const crate = await getCrateById(db, access.bottle.crateId as string);
  const cellar = crate ? await getCellarById(db, crate.cellarId) : null;
  if (!cellar || !isAiAvailable(cellar)) {
    return NextResponse.json({ error: 'Fonction IA indisponible pour cette cave.' }, { status: 403 });
  }

  const { system, content } = buildBottleAnalysisPrompt(access.bottle);

  let analysis;
  try {
    analysis = await callClaudeForJson({ system, content, schema: aiBottleAnalysisSchema });
  } catch (err) {
    if (err instanceof AiResponseError) {
      return NextResponse.json({ error: 'Réponse IA invalide, réessaie.' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 });
  }

  await saveBottleAiAnalysis(db, access.bottle, analysis);
  return NextResponse.json({ ok: true });
}
