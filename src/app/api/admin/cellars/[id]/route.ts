import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { listAllCellarsWithOwner, setCellarAiEnabled, deleteCellarCascade } from '@/domain/admin';

const updateCellarBodySchema = z.object({ aiEnabled: z.boolean() }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const rawBody = await request.json().catch(() => null);
  const parsed = updateCellarBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  await setCellarAiEnabled(db, id, parsed.data.aiEnabled);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const cellars = await listAllCellarsWithOwner(db);
  if (!cellars.some((c) => c.id === id)) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  await deleteCellarCascade(db, id);
  return NextResponse.json({ ok: true });
}
