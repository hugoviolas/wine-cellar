import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { setRegistrationEnabled } from '@/domain/appSettings';
import { readJsonBody } from '@/lib/readJsonBody';

const updateSettingsBodySchema = z.object({ registrationEnabled: z.boolean() }).strict();

export const PATCH = async (request: Request): Promise<NextResponse> => {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) {
    return auth.error;
  }

  const rawBody = await readJsonBody(request);
  const parsed = updateSettingsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  await setRegistrationEnabled(db, parsed.data.registrationEnabled);
  return NextResponse.json({ ok: true });
};
