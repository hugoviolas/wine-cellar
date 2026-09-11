import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { getSession } from '@/domain/session';
import { getInvitationByToken, acceptInvitation } from '@/domain/invitations';
import { createUserAccount, EmailAlreadyExistsError } from '@/domain/accounts';
import { getAppSettings } from '@/domain/appSettings';
import { authenticateUser } from '@/domain/authenticate';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rateLimit';

/** Route publique : même raisonnement que la réinitialisation de mot de passe. */
const PER_IP = { limit: 10, windowMs: 15 * 60 * 1000 };

const acceptBodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('login') }).strict(),
  z.object({ mode: z.literal('signup'), password: z.string().min(8) }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limit = checkRateLimit(`invitation:ip:${clientKeyFromHeaders(request.headers)}`, PER_IP);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const { token } = await params;
  const lookup = await getInvitationByToken(db, token);
  if (lookup.status !== 'valid') {
    return NextResponse.json({ error: 'Invitation invalide ou expirée.' }, { status: 400 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = acceptBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  let userId: string;

  if (parsed.data.mode === 'login') {
    const auth = await requireApiUser();
    if ('error' in auth) return auth.error;
    if (auth.user.email.toLowerCase() !== lookup.invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cette invitation est destinée à une autre adresse email.' },
        { status: 403 },
      );
    }
    userId = auth.user.id;
  } else {
    const settings = await getAppSettings(db);
    if (!settings.registrationEnabled) {
      return NextResponse.json(
        { error: 'Les inscriptions sont actuellement fermées. Contacte l’administrateur.' },
        { status: 403 },
      );
    }
    try {
      userId = await createUserAccount(db, lookup.invitation.email, parsed.data.password);
    } catch (err) {
      if (err instanceof EmailAlreadyExistsError) {
        return NextResponse.json(
          { error: 'Un compte existe déjà pour cet email — connecte-toi plutôt.' },
          { status: 409 },
        );
      }
      throw err;
    }
    const authedUser = await authenticateUser(db, lookup.invitation.email, parsed.data.password);
    if (!authedUser) throw new Error('Échec inattendu de connexion après création du compte.');
    const session = await getSession();
    session.userId = authedUser.id;
    session.issuedAt = new Date().toISOString();
    await session.save();
  }

  const { cellarId } = await acceptInvitation(db, token, userId);
  return NextResponse.json({ cellarId });
}
