import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { createCellarByAdmin } from '@/domain/admin';

const createCellarBodySchema = z.object({ name: z.string().min(1), ownerId: z.string().min(1) }).strict();

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = createCellarBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nom et owner requis.' }, { status: 400 });
  }

  const id = await createCellarByAdmin(db, parsed.data);
  return NextResponse.json({ id });
}
