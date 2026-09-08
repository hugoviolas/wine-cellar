import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, cellars, cellarMemberships, crates, bottles, consumptionHistory, invitations } from '../db/schema';
import { newId } from '../db/id';

export async function listAllUsers(db: Db) {
  return db.select().from(users);
}

export async function getUserById(db: Db, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function setUserActive(db: Db, userId: string, isActive: boolean): Promise<void> {
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

export async function setUserSuperAdmin(db: Db, userId: string, isSuperAdmin: boolean): Promise<void> {
  await db.update(users).set({ isSuperAdmin }).where(eq(users.id, userId));
}

/**
 * Indique s'il existe, en excluant `excludeUserId`, au moins un autre compte
 * super-admin actif. Sert à empêcher de rétrograder le dernier super-admin
 * actif restant (ce qui verrouillerait `/admin/**` pour tout le monde).
 */
export async function hasOtherActiveSuperAdmin(db: Db, excludeUserId: string): Promise<boolean> {
  const all = await listAllUsers(db);
  return all.some((u) => u.isSuperAdmin && u.isActive && u.id !== excludeUserId);
}

/**
 * `leftJoin` (pas `innerJoin`) : le propriétaire d'une cave peut avoir été
 * supprimé via `deleteUser` (qui ne touche jamais aux caves qu'il possède,
 * voir plus bas) — une jointure stricte ferait disparaître silencieusement
 * la cave de cette liste. `ownerEmail` vaut alors `null`, à afficher comme
 * "compte supprimé" côté UI.
 */
export async function listAllCellarsWithOwner(db: Db) {
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
}

export async function setCellarAiEnabled(db: Db, cellarId: string, aiEnabled: boolean): Promise<void> {
  await db.update(cellars).set({ aiEnabled }).where(eq(cellars.id, cellarId));
}

/**
 * Supprime une cave et tout ce qui lui appartient : bouteilles, clayettes,
 * historique de consommation, invitations et memberships. Irréversible —
 * la confirmation se fait côté UI/route, pas ici.
 */
export async function deleteCellarCascade(db: Db, cellarId: string): Promise<void> {
  const cellarCrates = await db.select({ id: crates.id }).from(crates).where(eq(crates.cellarId, cellarId));
  const crateIds = cellarCrates.map((c) => c.id);
  if (crateIds.length > 0) {
    await db.delete(bottles).where(inArray(bottles.crateId, crateIds));
  }
  await db.delete(crates).where(eq(crates.cellarId, cellarId));
  await db.delete(consumptionHistory).where(eq(consumptionHistory.cellarId, cellarId));
  await db.delete(invitations).where(eq(invitations.cellarId, cellarId));
  await db.delete(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));
  await db.delete(cellars).where(eq(cellars.id, cellarId));
}

/**
 * Supprime uniquement le compte — ne touche jamais aux caves qu'il possède,
 * à ses memberships, son historique ou ses invitations envoyées (demande
 * explicite : la suppression d'un compte ne doit rien casser ailleurs).
 * Ces lignes restent avec une référence vers un utilisateur qui n'existe
 * plus plutôt que d'être supprimées ou bloquées — voir `listAllCellarsWithOwner`
 * et `listCellarMembersWithEmail` pour l'affichage `leftJoin` correspondant.
 */
export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export async function countMembersByCellarId(db: Db): Promise<Record<string, number>> {
  const rows = await db.select({ cellarId: cellarMemberships.cellarId }).from(cellarMemberships);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.cellarId] = (counts[row.cellarId] ?? 0) + 1;
  }
  return counts;
}

export interface CreateCellarInput {
  name: string;
  ownerId: string;
}

export async function createCellarByAdmin(db: Db, input: CreateCellarInput): Promise<string> {
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
}
