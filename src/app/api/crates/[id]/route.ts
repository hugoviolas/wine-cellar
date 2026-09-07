import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { renameCrate, deleteCrate, getCrateById, crateHasActiveBottles } from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
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
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

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
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  if (await crateHasActiveBottles(db, id)) {
    return NextResponse.json(
      { error: 'Cette clayette contient encore des bouteilles.' },
      { status: 409 },
    );
  }

  // Les bouteilles épuisées (quantité 0) restées rattachées à cette clayette
  // deviennent orphelines (crate_id à null) grâce à la clé étrangère en
  // ON DELETE SET NULL — leur historique de consommation reste intact.
  await deleteCrate(db, id);
  return NextResponse.json({ ok: true });
}
