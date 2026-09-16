import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { createCellarByAdmin } from '@/domain/admin';
import { readJsonBody } from '@/lib/readJsonBody';

const createCellarBodySchema = z.object({ name: z.string().min(1), ownerId: z.string().min(1) }).strict();

export const POST = async (request: Request): Promise<NextResponse> => {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) {
    return auth.error;
  }

  const rawBody = await readJsonBody(request);
  const parsed = createCellarBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nom et propriétaire requis.' }, { status: 400 });
  }

  const id = await createCellarByAdmin(db, parsed.data);
  return NextResponse.json({ id });
};
