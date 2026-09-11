import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cellarMemberships, users } from '../db/schema';

export class CannotModifyOwnerError extends Error {}

/**
 * `leftJoin` (pas `innerJoin`) : un membre peut avoir été supprimé via
 * `deleteUser`, qui ne touche jamais aux memberships (voir domain/admin.ts)
 * — une jointure stricte ferait disparaître silencieusement la ligne de
 * cette liste. `email` vaut alors `null`, à afficher comme "compte
 * supprimé" côté UI.
 */
export async function listCellarMembersWithEmail(db: Db, cellarId: string) {
  return db
    .select({
      membershipId: cellarMemberships.id,
      userId: cellarMemberships.userId,
      email: users.email,
      role: cellarMemberships.role,
      createdAt: cellarMemberships.createdAt,
    })
    .from(cellarMemberships)
    .leftJoin(users, eq(cellarMemberships.userId, users.id))
    .where(eq(cellarMemberships.cellarId, cellarId));
}

export async function getMembershipById(db: Db, membershipId: string) {
  const [row] = await db.select().from(cellarMemberships).where(eq(cellarMemberships.id, membershipId)).limit(1);
  return row ?? null;
}

export async function updateMembershipRole(
  db: Db,
  membershipId: string,
  role: 'editor' | 'reader',
): Promise<void> {
  const membership = await getMembershipById(db, membershipId);
  if (!membership) throw new Error('Membre introuvable.');
  if (membership.role === 'owner') throw new CannotModifyOwnerError();
  await db.update(cellarMemberships).set({ role }).where(eq(cellarMemberships.id, membershipId));
}

export async function removeMembership(db: Db, membershipId: string): Promise<void> {
  const membership = await getMembershipById(db, membershipId);
  if (!membership) throw new Error('Membre introuvable.');
  if (membership.role === 'owner') throw new CannotModifyOwnerError();
  await db.delete(cellarMemberships).where(eq(cellarMemberships.id, membershipId));
}
