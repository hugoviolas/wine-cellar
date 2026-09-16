import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getSession } from '@/domain/session';
import { isSessionStillValid } from '@/domain/sessionValidity';
import type { ApiUser } from './interfaces/api-user.interface';

export type { ApiUser };

export type ApiUserResult = { user: ApiUser } | { error: NextResponse };

export const requireApiUser = async (): Promise<ApiUserResult> => {
  const session = await getSession();
  if (!session.userId) {
    return { error: unauthorized() };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) {
    return { error: unauthorized() };
  }
  // Session antérieure à une réinitialisation de mot de passe : le cookie
  // est intact et déchiffrable, mais ne vaut plus rien.
  if (!isSessionStillValid({ user, issuedAt: session.issuedAt })) {
    session.destroy();
    return { error: unauthorized() };
  }

  return { user: { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin } };
};

/**
 * Même réponse pour « pas de session », « compte inconnu », « compte
 * désactivé » et « session périmée » : distinguer ces cas renseignerait un
 * appelant non authentifié sur l'existence et l'état d'un compte.
 */
const unauthorized = (): NextResponse => {
  return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
};
