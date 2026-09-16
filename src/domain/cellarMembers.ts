import { eq } from 'drizzle-orm';
import type { CellarMembershipRow } from '../db/rows';
import type { CellarMemberWithEmail } from './interfaces/cellar-member-with-email.interface';
import { cellarMemberships, users } from '../db/schema';
import type { ListCellarMembersWithEmailArgs } from './interfaces/list-cellar-members-with-email-args.interface';
import type { GetMembershipByIdArgs } from './interfaces/get-membership-by-id-args.interface';
import type { UpdateMembershipRoleArgs } from './interfaces/update-membership-role-args.interface';
import type { RemoveMembershipArgs } from './interfaces/remove-membership-args.interface';

export class CannotModifyOwnerError extends Error {}

/**
 * `leftJoin` (pas `innerJoin`) : un membre peut avoir été supprimé via
 * `deleteUser`, qui ne touche jamais aux memberships (voir domain/admin.ts)
 * — une jointure stricte ferait disparaître silencieusement la ligne de
 * cette liste. `email` vaut alors `null`, à afficher comme "compte
 * supprimé" côté UI.
 */
export const listCellarMembersWithEmail = async ({
  db,
  cellarId,
}: ListCellarMembersWithEmailArgs): Promise<CellarMemberWithEmail[]> => {
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
};

export const getMembershipById = async ({
  db,
  membershipId,
}: GetMembershipByIdArgs): Promise<CellarMembershipRow | null> => {
  const [row] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.id, membershipId))
    .limit(1);
  return row ?? null;
};

export const updateMembershipRole = async ({
  db,
  membershipId,
  role,
}: UpdateMembershipRoleArgs): Promise<void> => {
  const membership = await getMembershipById({ db, membershipId });
  if (!membership) {
    throw new Error('Membre introuvable.');
  }
  if (membership.role === 'owner') {
    throw new CannotModifyOwnerError();
  }
  await db.update(cellarMemberships).set({ role }).where(eq(cellarMemberships.id, membershipId));
};

export const removeMembership = async ({ db, membershipId }: RemoveMembershipArgs): Promise<void> => {
  const membership = await getMembershipById({ db, membershipId });
  if (!membership) {
    throw new Error('Membre introuvable.');
  }
  if (membership.role === 'owner') {
    throw new CannotModifyOwnerError();
  }
  await db.delete(cellarMemberships).where(eq(cellarMemberships.id, membershipId));
};
