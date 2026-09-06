import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { db } from '@/db/client';
import { getBottle } from '@/domain/bottles';
import { getCrateById } from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';
import { consumeBottle, BottleUnavailableError } from '@/domain/consume';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const bottle = await getBottle(db, id);
  if (!bottle) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const crate = await getCrateById(db, bottle.crateId);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  try {
    const historyId = await consumeBottle(db, {
      bottleId: id,
      consumedByUserId: user.id,
      consumedAt: body.consumedAt ?? new Date().toISOString().slice(0, 10),
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
