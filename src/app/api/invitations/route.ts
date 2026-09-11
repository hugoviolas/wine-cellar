import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import { createInvitation, createInvitationBodySchema } from '@/domain/invitations';

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rawBody = await request.json().catch(() => null);
  const parsed = createInvitationBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invitation invalide : email, rôle et cave sont requis.' }, { status: 400 });
  }
  const input = parsed.data;

  const access = await checkCellarAccess(db, user.id, input.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canManageCellar(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour inviter un membre.' }, { status: 403 });
  }

  const { token } = await createInvitation(db, { ...input, invitedByUserId: user.id });
  return NextResponse.json({ token });
}
