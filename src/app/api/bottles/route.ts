import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { getCrateById } from '@/domain/crates';
import { createBottle, listActiveBottlesByCellar } from '@/domain/bottles';

export async function GET(request: Request) {
  const user = await requireUser();
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listActiveBottlesByCellar(db, cellarId));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();

  const crate = await getCrateById(db, body.crateId);
  if (!crate) return NextResponse.json({ error: 'Clayette introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  try {
    const id = await createBottle(db, body);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: 'Détails invalides pour cette catégorie' }, { status: 400 });
  }
}
