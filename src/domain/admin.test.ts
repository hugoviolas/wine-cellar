import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { createCrate, getCrateById } from './crates';
import { createBottle, getBottle } from './bottles';
import { consumeBottle } from './consume';
import { createInvitation } from './invitations';
import { listConsumptionHistory } from './history';
import { cellars, cellarMemberships, invitations } from '../db/schema';
import {
  listAllUsers,
  getUserById,
  setUserActive,
  setUserSuperAdmin,
  listAllCellarsWithOwner,
  countMembersByCellarId,
  createCellarByAdmin,
  hasOtherActiveSuperAdmin,
  setCellarAiEnabled,
  deleteCellarCascade,
  deleteUser,
} from './admin';

describe('listAllUsers', () => {
  it('liste tous les comptes tous statuts confondus', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, { email: 'admin@example.com', password: 'x', cellarName: 'Cave' });
    await createUserAccount(db, 'membre@example.com', 'x');

    const list = await listAllUsers(db);
    expect(list).toHaveLength(2);
  });
});

describe('setUserActive', () => {
  it('désactive puis réactive un compte', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'x');

    await setUserActive(db, userId, false);
    expect((await getUserById(db, userId))?.isActive).toBe(false);

    await setUserActive(db, userId, true);
    expect((await getUserById(db, userId))?.isActive).toBe(true);
  });
});

describe('setUserSuperAdmin', () => {
  it('promeut puis rétrograde un compte', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'x');

    await setUserSuperAdmin(db, userId, true);
    expect((await getUserById(db, userId))?.isSuperAdmin).toBe(true);

    await setUserSuperAdmin(db, userId, false);
    expect((await getUserById(db, userId))?.isSuperAdmin).toBe(false);
  });
});

describe('listAllCellarsWithOwner', () => {
  it('liste toutes les caves avec l’email du owner', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });

    const list = await listAllCellarsWithOwner(db);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Cave A');
    expect(list[0].ownerEmail).toBe('a@example.com');
  });
});

describe('countMembersByCellarId', () => {
  it('compte les membres par cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });

    const counts = await countMembersByCellarId(db);
    expect(counts[cellarId]).toBe(1);
  });
});

describe('hasOtherActiveSuperAdmin', () => {
  it('retourne false quand le compte exclu est le seul super-admin actif', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'seul@example.com', password: 'x', cellarName: 'Cave' });

    expect(await hasOtherActiveSuperAdmin(db, userId)).toBe(false);
  });

  it('retourne true quand un autre super-admin actif existe', async () => {
    const db = await createTestDb();
    const { userId: firstId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const secondId = await createUserAccount(db, 'b@example.com', 'x');
    await setUserSuperAdmin(db, secondId, true);

    expect(await hasOtherActiveSuperAdmin(db, firstId)).toBe(true);
  });

  it('ignore un autre super-admin désactivé', async () => {
    const db = await createTestDb();
    const { userId: firstId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const secondId = await createUserAccount(db, 'b@example.com', 'x');
    await setUserSuperAdmin(db, secondId, true);
    await setUserActive(db, secondId, false);

    expect(await hasOtherActiveSuperAdmin(db, firstId)).toBe(false);
  });
});

describe('createCellarByAdmin', () => {
  it('crée une cave et son membership owner', async () => {
    const db = await createTestDb();
    const ownerId = await createUserAccount(db, 'owner@example.com', 'x');

    const cellarId = await createCellarByAdmin(db, { name: 'Nouvelle cave', ownerId });

    const list = await listAllCellarsWithOwner(db);
    expect(list.find((c) => c.id === cellarId)?.ownerEmail).toBe('owner@example.com');
    const counts = await countMembersByCellarId(db);
    expect(counts[cellarId]).toBe(1);
  });
});

describe('setCellarAiEnabled', () => {
  it('active puis désactive l’IA pour une cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    await setCellarAiEnabled(db, cellarId, false);
    expect((await listAllCellarsWithOwner(db)).find((c) => c.id === cellarId)?.aiEnabled).toBe(false);

    await setCellarAiEnabled(db, cellarId, true);
    expect((await listAllCellarsWithOwner(db)).find((c) => c.id === cellarId)?.aiEnabled).toBe(true);
  });
});

describe('listAllCellarsWithOwner (propriétaire supprimé)', () => {
  it('conserve la cave avec un email de propriétaire nul quand le propriétaire est supprimé', async () => {
    const db = await createTestDb();
    const { cellarId, userId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave A',
    });

    await deleteUser(db, userId);

    const list = await listAllCellarsWithOwner(db);
    const cellar = list.find((c) => c.id === cellarId);
    expect(cellar).toBeDefined();
    expect(cellar?.ownerEmail).toBeNull();
  });
});

describe('deleteUser', () => {
  it('supprime uniquement le compte, sans toucher aux caves ou memberships qu’il possède', async () => {
    const db = await createTestDb();
    const { cellarId, userId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave A',
    });

    await deleteUser(db, userId);

    expect(await getUserById(db, userId)).toBeNull();
    // La cave et le membership survivent intacts, seule la ligne users a disparu.
    const [cellar] = await db.select().from(cellars).where(eq(cellars.id, cellarId));
    expect(cellar).toBeDefined();
    // FK `set null` : la ligne survit intacte, seule la référence à
    // l'utilisateur supprimé devient nulle (users.id n'existe plus).
    const memberships = await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));
    expect(memberships).toHaveLength(1);
    expect(memberships[0].userId).toBeNull();
  });
});

describe('deleteCellarCascade', () => {
  it('supprime la cave et tout ce qui lui appartient (clayettes, bouteilles, historique, invitations, memberships)', async () => {
    const db = await createTestDb();
    const { cellarId, userId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave A',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Vin test',
      quantity: 2,
      details: {},
    });
    await consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: new Date().toISOString() });
    await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'editor', invitedByUserId: userId });

    await deleteCellarCascade(db, cellarId);

    expect(await getCrateById(db, crateId)).toBeNull();
    expect(await getBottle(db, bottleId)).toBeNull();
    expect(await listConsumptionHistory(db, cellarId)).toHaveLength(0);
    const remainingInvitations = await db.select().from(invitations).where(eq(invitations.cellarId, cellarId));
    expect(remainingInvitations).toHaveLength(0);
    const remainingMemberships = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.cellarId, cellarId));
    expect(remainingMemberships).toHaveLength(0);
    const [cellar] = await db.select().from(cellars).where(eq(cellars.id, cellarId));
    expect(cellar).toBeUndefined();
    // L'utilisateur lui-même n'est pas touché par la suppression de sa cave.
    expect(await getUserById(db, userId)).not.toBeNull();
  });
});
