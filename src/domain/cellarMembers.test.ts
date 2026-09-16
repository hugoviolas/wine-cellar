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
import { firstRow } from '../db/testRows';
import type { AddMemberArgs } from './interfaces/add-member-args.interface';

interface AddedMember {
  userId: string;
  membershipId: string;
}

const addMember = async ({ db, cellarId, email, role }: AddMemberArgs): Promise<AddedMember> => {
  const userId = await createUserAccount({ db, email, password: 'x' });
  const membershipId = newId();
  await db.insert(cellarMemberships).values({
    id: membershipId,
    cellarId,
    userId,
    role,
    createdAt: new Date().toISOString(),
  });
  return { userId, membershipId };
};

describe('listCellarMembersWithEmail', () => {
  it('liste les membres avec leur email et leur rôle', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'owner@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    await addMember({ db, cellarId, email: 'editeur@example.com', role: 'editor' });

    const members = await listCellarMembersWithEmail({ db, cellarId });
    expect(members).toHaveLength(2);
    const emails = members.map((m) => m.email).sort();
    expect(emails).toEqual(['editeur@example.com', 'owner@example.com']);
  });

  it('conserve le membership avec un email nul quand le membre est supprimé', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'owner@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const { userId } = await addMember({ db, cellarId, email: 'editeur@example.com', role: 'editor' });

    await deleteUser({ db, userId });

    const members = await listCellarMembersWithEmail({ db, cellarId });
    expect(members).toHaveLength(2);
    const deletedMember = members.find((m) => m.userId === null);
    expect(deletedMember).toBeDefined();
    expect(deletedMember?.email).toBeNull();
  });
});

describe('updateMembershipRole', () => {
  it('change le rôle d’un membre non-owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'owner@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const { membershipId } = await addMember({ db, cellarId, email: 'membre@example.com', role: 'reader' });

    await updateMembershipRole({ db, membershipId, role: 'editor' });
    const updated = await getMembershipById({ db, membershipId });
    expect(updated?.role).toBe('editor');
  });

  it('refuse de changer le rôle du owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'owner@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const ownerMembership = firstRow(
      await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId)),
    );

    await expect(
      updateMembershipRole({ db, membershipId: ownerMembership.id, role: 'editor' }),
    ).rejects.toBeInstanceOf(CannotModifyOwnerError);
  });
});

describe('removeMembership', () => {
  it('retire un membre non-owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'owner@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const { membershipId } = await addMember({ db, cellarId, email: 'membre@example.com', role: 'reader' });

    await removeMembership({ db, membershipId });
    expect(await getMembershipById({ db, membershipId })).toBeNull();
  });

  it('refuse de retirer le owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'owner@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const ownerMembership = firstRow(
      await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId)),
    );

    await expect(removeMembership({ db, membershipId: ownerMembership.id })).rejects.toBeInstanceOf(
      CannotModifyOwnerError,
    );
  });
});
