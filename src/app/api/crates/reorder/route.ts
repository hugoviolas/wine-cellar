import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { reorderCrates } from '@/domain/crates';

const reorderBodySchema = z
  .object({
    cellarId: z.string().min(1),
    orderedIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rawBody = await request.json().catch(() => null);
  const parsed = reorderBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête de réordonnancement invalide.' }, { status: 400 });
  }
  const { cellarId, orderedIds } = parsed.data;

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  try {
    await reorderCrates(db, cellarId, orderedIds);
  } catch {
    return NextResponse.json(
      { error: 'La liste fournie ne correspond pas aux clayettes de cette cave.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
