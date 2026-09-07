import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { createBottle, listActiveBottlesByCellar } from '@/domain/bottles';

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listActiveBottlesByCellar(db, cellarId));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const body = await request.json();

  const crate = await getCrateById(db, body.crateId);
  if (!crate) return NextResponse.json({ error: 'Clayette introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  try {
    const id = await createBottle(db, body);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'Détails invalides pour cette catégorie' }, { status: 400 });
  }
}
