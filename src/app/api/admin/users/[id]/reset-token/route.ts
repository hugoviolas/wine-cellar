import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { getUserById } from '@/domain/admin';
import { createResetToken } from '@/domain/passwordReset';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const target = await getUserById(db, id);
  if (!target) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const token = await createResetToken(db, id);
  return NextResponse.json({ token });
}
