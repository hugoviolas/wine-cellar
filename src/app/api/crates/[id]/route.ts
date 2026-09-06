import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { renameCrate, deleteCrate } from '@/domain/crates';
import { db } from '@/db/client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const body = await request.json();
  await renameCrate(db, id, body.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  await deleteCrate(db, id);
  return NextResponse.json({ ok: true });
}
