import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { reorderBottlesInCrate } from '@/domain/bottles';

const reorderBodySchema = z
  .object({
    crateId: z.string().min(1),
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
  const { crateId, orderedIds } = parsed.data;

  const crate = await getCrateById(db, crateId);
  if (!crate) return NextResponse.json({ error: 'Clayette introuvable' }, { status: 404 });

  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  try {
    await reorderBottlesInCrate(db, crateId, orderedIds);
  } catch {
    return NextResponse.json(
      { error: 'La liste fournie ne correspond pas aux bouteilles actives de cette clayette.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
