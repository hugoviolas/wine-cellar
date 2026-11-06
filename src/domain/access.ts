import { eq, and } from 'drizzle-orm';
import { cellarMemberships, users } from '../db/schema';
import type { CheckCellarAccessArgs } from './interfaces/check-cellar-access-args.interface';

export type MemberRole = 'owner' | 'editor' | 'reader';
export type CellarRole = MemberRole | 'super_admin';
export type AccessResult = { allowed: true; role: CellarRole } | { allowed: false };

/**
 * Rôle tenu dans une cave par adhésion, ou `null` : contrairement à
 * `checkCellarAccess`, aucun accès transverse du super-admin. C'est la
 * règle de l'accès par MCP (voir src/mcp/access.ts) — un jeton remis à une
 * application tierce n'ouvre que les caves dont le compte est membre.
 */
export const getMemberRole = async ({
  db,
  userId,
  cellarId,
}: CheckCellarAccessArgs): Promise<MemberRole | null> => {
  const [membership] = await db
    .select({ role: cellarMemberships.role })
    .from(cellarMemberships)
    .where(and(eq(cellarMemberships.cellarId, cellarId), eq(cellarMemberships.userId, userId)))
    .limit(1);
  return membership?.role ?? null;
};

export const checkCellarAccess = async ({
  db,
  userId,
  cellarId,
}: CheckCellarAccessArgs): Promise<AccessResult> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { allowed: false };
  }
  if (user.isSuperAdmin) {
    return { allowed: true, role: 'super_admin' };
  }

  const role = await getMemberRole({ db, userId, cellarId });
  return role === null ? { allowed: false } : { allowed: true, role };
};
