import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { setCellarAiEnabled, deleteCellarCascade } from '@/domain/admin';
import { getCellarById } from '@/domain/cellars';
import { readJsonBody } from '@/lib/readJsonBody';

const updateCellarBodySchema = z.object({ aiEnabled: z.boolean() }).strict();

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const rawBody = await readJsonBody(request);
  const parsed = updateCellarBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  await setCellarAiEnabled({ db, cellarId: id, aiEnabled: parsed.data.aiEnabled });
  return NextResponse.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const cellar = await getCellarById({ db, cellarId: id });
  if (!cellar) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  await deleteCellarCascade({ db, cellarId: id });
  return NextResponse.json({ ok: true });
};
