import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { db } from '@/db/client';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { consumeBottle, BottleUnavailableError } from '@/domain/consume';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const access = await resolveBottleAccess(db, user.id, id);
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const historyId = await consumeBottle(db, {
      bottleId: id,
      consumedByUserId: user.id,
      consumedAt: body.consumedAt ?? new Date().toISOString().slice(0, 10),
      quantity: body.quantity,
      rating: body.rating,
      comment: body.comment,
      occasion: body.occasion,
    });
    return NextResponse.json({ historyId });
  } catch (err) {
    if (err instanceof BottleUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
