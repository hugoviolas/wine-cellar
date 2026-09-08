import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { newId } from '../db/id';
import { cellarMemberships } from '../db/schema';
import { deleteUser } from './admin';
import {
  listCellarMembersWithEmail,
  getMembershipById,
  updateMembershipRole,
  removeMembership,
  CannotModifyOwnerError,
} from './cellarMembers';

async function addMember(db: Awaited<ReturnType<typeof createTestDb>>, cellarId: string, email: string, role: 'editor' | 'reader') {
  const userId = await createUserAccount(db, email, 'x');
  const membershipId = newId();
  await db.insert(cellarMemberships).values({
    id: membershipId,
    cellarId,
    userId,
    role,
    createdAt: new Date().toISOString(),
  });
  return { userId, membershipId };
}

describe('listCellarMembersWithEmail', () => {
  it('liste les membres avec leur email et leur rôle', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    await addMember(db, cellarId, 'editeur@example.com', 'editor');

    const members = await listCellarMembersWithEmail(db, cellarId);
    expect(members).toHaveLength(2);
    const emails = members.map((m) => m.email).sort();
    expect(emails).toEqual(['editeur@example.com', 'owner@example.com']);
  });

  it('conserve le membership avec un email nul quand le membre est supprimé', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { userId } = await addMember(db, cellarId, 'editeur@example.com', 'editor');

    await deleteUser(db, userId);

    const members = await listCellarMembersWithEmail(db, cellarId);
    expect(members).toHaveLength(2);
    const deletedMember = members.find((m) => m.userId === null);
    expect(deletedMember).toBeDefined();
    expect(deletedMember?.email).toBeNull();
  });
});

describe('updateMembershipRole', () => {
  it('change le rôle d’un membre non-owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { membershipId } = await addMember(db, cellarId, 'membre@example.com', 'reader');

    await updateMembershipRole(db, membershipId, 'editor');
    const updated = await getMembershipById(db, membershipId);
    expect(updated?.role).toBe('editor');
  });

  it('refuse de changer le rôle du owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const [ownerMembership] = await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));

    await expect(updateMembershipRole(db, ownerMembership.id, 'editor')).rejects.toBeInstanceOf(
      CannotModifyOwnerError,
    );
  });
});

describe('removeMembership', () => {
  it('retire un membre non-owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { membershipId } = await addMember(db, cellarId, 'membre@example.com', 'reader');

    await removeMembership(db, membershipId);
    expect(await getMembershipById(db, membershipId)).toBeNull();
  });

  it('refuse de retirer le owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const [ownerMembership] = await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));

    await expect(removeMembership(db, ownerMembership.id)).rejects.toBeInstanceOf(CannotModifyOwnerError);
  });
});
