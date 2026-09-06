import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { db } from '@/db/client';
import { updateBottle, deleteBottle, updateBottleBodySchema } from '@/domain/bottles';
import { resolveBottleAccess, type BottleAccessResult } from '@/domain/bottleAccess';

type BottleAccessOutcome =
  | { bottle: Extract<BottleAccessResult, { status: 'ok' }>['bottle']; error: null }
  | { bottle: null; error: NextResponse };

async function requireBottleAccess(userId: string, bottleId: string): Promise<BottleAccessOutcome> {
  const result = await resolveBottleAccess(db, userId, bottleId);
  if (result.status === 'not_found') {
    return { bottle: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  if (result.status === 'forbidden') {
    return { bottle: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { bottle: result.bottle, error: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { bottle, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  return NextResponse.json(bottle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;

  const rawBody = await request.json().catch(() => null);
  const parsed = updateBottleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs de mise à jour invalides.' }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  await updateBottle(db, id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  await deleteBottle(db, id);
  return NextResponse.json({ ok: true });
}
