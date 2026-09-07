import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import { updateCellarInfo } from '@/domain/cellars';

const updateCellarInfoBodySchema = z
  .object({
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const access = await checkCellarAccess(db, user.id, id);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canManageCellar(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = updateCellarInfoBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  await updateCellarInfo(db, id, parsed.data);
  return NextResponse.json({ ok: true });
}
