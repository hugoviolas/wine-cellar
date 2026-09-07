import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { getUserById, setUserActive, setUserSuperAdmin } from '@/domain/admin';

const updateUserBodySchema = z
  .object({
    isActive: z.boolean().optional(),
    isSuperAdmin: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const target = await getUserById(db, id);
  if (!target) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const rawBody = await request.json().catch(() => null);
  const parsed = updateUserBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  if (parsed.data.isActive !== undefined) {
    await setUserActive(db, id, parsed.data.isActive);
  }
  if (parsed.data.isSuperAdmin !== undefined) {
    await setUserSuperAdmin(db, id, parsed.data.isSuperAdmin);
  }
  return NextResponse.json({ ok: true });
}
