import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { renameCrate, deleteCrate, getCrateById } from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';
import { db } from '@/db/client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const body = await request.json();
  await renameCrate(db, id, body.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  await deleteCrate(db, id);
  return NextResponse.json({ ok: true });
}
