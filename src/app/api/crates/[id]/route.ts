import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { renameCrate, deleteCrate, getCrateById } from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';
import { db } from '@/db/client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Nom de clayette requis.' }, { status: 400 });

  await renameCrate(db, id, name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  try {
    await deleteCrate(db, id);
  } catch {
    // La clé étrangère bottles.crate_id empêche la suppression d'une clayette
    // qui contient encore des bouteilles.
    return NextResponse.json(
      { error: 'Cette clayette contient encore des bouteilles.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
