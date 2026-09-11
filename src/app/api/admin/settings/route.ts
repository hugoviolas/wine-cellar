import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { setRegistrationEnabled } from '@/domain/appSettings';

const updateSettingsBodySchema = z.object({ registrationEnabled: z.boolean() }).strict();

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  if (!auth.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Accès réservé au super-admin.' }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = updateSettingsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  await setRegistrationEnabled(db, parsed.data.registrationEnabled);
  return NextResponse.json({ ok: true });
}
