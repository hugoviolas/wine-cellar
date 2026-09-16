import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { UserRow } from '../db/rows';
import type { CellarWithOwner } from './interfaces/cellar-with-owner.interface';
import type { CreateCellarInput } from './interfaces/create-cellar-input.interface';
import {
  users,
  cellars,
  cellarMemberships,
  crates,
  bottles,
  consumptionHistory,
  invitations,
} from '../db/schema';
import { newId } from '../db/id';
import type { GetUserByIdArgs } from './interfaces/get-user-by-id-args.interface';
import type { SetUserActiveArgs } from './interfaces/set-user-active-args.interface';
import type { SetUserSuperAdminArgs } from './interfaces/set-user-super-admin-args.interface';
import type { HasOtherActiveSuperAdminArgs } from './interfaces/has-other-active-super-admin-args.interface';
import type { SetCellarAiEnabledArgs } from './interfaces/set-cellar-ai-enabled-args.interface';
import type { DeleteCellarCascadeArgs } from './interfaces/delete-cellar-cascade-args.interface';
import type { DeleteUserArgs } from './interfaces/delete-user-args.interface';
import type { CreateCellarByAdminArgs } from './interfaces/create-cellar-by-admin-args.interface';

export type { CreateCellarInput };

export const listAllUsers = async (db: Db): Promise<UserRow[]> => {
  return db.select().from(users);
};

export const getUserById = async ({ db, userId }: GetUserByIdArgs): Promise<UserRow | null> => {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
};

export const setUserActive = async ({ db, userId, isActive }: SetUserActiveArgs): Promise<void> => {
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
};

export const setUserSuperAdmin = async ({
  db,
  userId,
  isSuperAdmin,
}: SetUserSuperAdminArgs): Promise<void> => {
  await db.update(users).set({ isSuperAdmin }).where(eq(users.id, userId));
};

/**
 * Indique s'il existe, en excluant `excludeUserId`, au moins un autre compte
 * super-admin actif. Sert à empêcher de rétrograder le dernier super-admin
 * actif restant (ce qui verrouillerait `/admin/**` pour tout le monde).
 */
export const hasOtherActiveSuperAdmin = async ({
  db,
  excludeUserId,
}: HasOtherActiveSuperAdminArgs): Promise<boolean> => {
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isSuperAdmin, true), eq(users.isActive, true), ne(users.id, excludeUserId)))
    .limit(1);
  return other !== undefined;
};

/**
 * `leftJoin` (pas `innerJoin`) : le propriétaire d'une cave peut avoir été
 * supprimé via `deleteUser` (qui ne touche jamais aux caves qu'il possède,
 * voir plus bas) — une jointure stricte ferait disparaître silencieusement
 * la cave de cette liste. `ownerEmail` vaut alors `null`, à afficher comme
 * "compte supprimé" côté UI.
 */
export const listAllCellarsWithOwner = async (db: Db): Promise<CellarWithOwner[]> => {
  return db
    .select({
      id: cellars.id,
      name: cellars.name,
      ownerId: cellars.ownerId,
      ownerEmail: users.email,
      aiEnabled: cellars.aiEnabled,
      createdAt: cellars.createdAt,
    })
    .from(cellars)
    .leftJoin(users, eq(cellars.ownerId, users.id));
};

export const setCellarAiEnabled = async ({
  db,
  cellarId,
  aiEnabled,
}: SetCellarAiEnabledArgs): Promise<void> => {
  await db.update(cellars).set({ aiEnabled }).where(eq(cellars.id, cellarId));
};

/**
 * Supprime une cave et tout ce qui lui appartient : bouteilles, clayettes,
 * historique de consommation, invitations et memberships. Irréversible —
 * la confirmation se fait côté UI/route, pas ici.
 */
export const deleteCellarCascade = async ({ db, cellarId }: DeleteCellarCascadeArgs): Promise<void> => {
  // Une transaction, parce que c'est six suppressions en chaîne : une
  // erreur au milieu laisserait sinon une cave à moitié effacée (des
  // clayettes sans bouteilles, un historique orphelin), état dont
  // l'application n'a aucun moyen de se remettre toute seule.
  await db.transaction(async (tx) => {
    const cellarCrates = await tx.select({ id: crates.id }).from(crates).where(eq(crates.cellarId, cellarId));
    const crateIds = cellarCrates.map((c) => c.id);
    if (crateIds.length > 0) {
      await tx.delete(bottles).where(inArray(bottles.crateId, crateIds));
    }
    await tx.delete(crates).where(eq(crates.cellarId, cellarId));
    await tx.delete(consumptionHistory).where(eq(consumptionHistory.cellarId, cellarId));
    await tx.delete(invitations).where(eq(invitations.cellarId, cellarId));
    await tx.delete(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));
    await tx.delete(cellars).where(eq(cellars.id, cellarId));
  });
};

/**
 * Supprime uniquement le compte — ne touche jamais aux caves qu'il possède,
 * à ses memberships, son historique ou ses invitations envoyées (demande
 * explicite : la suppression d'un compte ne doit rien casser ailleurs).
 * Ces lignes restent avec une référence vers un utilisateur qui n'existe
 * plus plutôt que d'être supprimées ou bloquées — voir `listAllCellarsWithOwner`
 * et `listCellarMembersWithEmail` pour l'affichage `leftJoin` correspondant.
 */
export const deleteUser = async ({ db, userId }: DeleteUserArgs): Promise<void> => {
  await db.delete(users).where(eq(users.id, userId));
};

export const countMembersByCellarId = async (db: Db): Promise<Record<string, number>> => {
  const rows = await db.select({ cellarId: cellarMemberships.cellarId }).from(cellarMemberships);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.cellarId] = (counts[row.cellarId] ?? 0) + 1;
  }
  return counts;
};

export const createCellarByAdmin = async ({ db, input }: CreateCellarByAdminArgs): Promise<string> => {
  const id = newId();
  const now = new Date().toISOString();
  await db.insert(cellars).values({
    id,
    name: input.name,
    ownerId: input.ownerId,
    aiEnabled: true,
    createdAt: now,
  });
  await db.insert(cellarMemberships).values({
    id: newId(),
    cellarId: id,
    userId: input.ownerId,
    role: 'owner',
    createdAt: now,
  });
  return id;
};
