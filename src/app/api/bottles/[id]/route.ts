import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { db } from '@/db/client';
import { getBottle, updateBottle, deleteBottle } from '@/domain/bottles';
import { getCrateById } from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';

async function requireBottleAccess(userId: string, bottleId: string) {
  const bottle = await getBottle(db, bottleId);
  if (!bottle) return { bottle: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  const crate = await getCrateById(db, bottle.crateId);
  if (!crate) return { bottle: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  const access = await checkCellarAccess(db, userId, crate.cellarId);
  if (!access.allowed) return { bottle: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { bottle, error: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { bottle, error } = await requireBottleAccess(user.id, id);
  if (error) return error;
  return NextResponse.json(bottle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await requireBottleAccess(user.id, id);
  if (error) return error;
  const body = await request.json();
  await updateBottle(db, id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await requireBottleAccess(user.id, id);
  if (error) return error;
  await deleteBottle(db, id);
  return NextResponse.json({ ok: true });
}
