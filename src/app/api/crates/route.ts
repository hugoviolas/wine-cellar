import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { createCrate, listCrates } from '@/domain/crates';

export async function GET(request: Request) {
  const user = await requireUser();
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listCrates(db, cellarId));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const access = await checkCellarAccess(db, user.id, body.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const id = await createCrate(db, {
    cellarId: body.cellarId,
    name: body.name,
    capacity: body.capacity,
  });
  return NextResponse.json({ id });
}
