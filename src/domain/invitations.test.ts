import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
} from './invitations';
import { invitations, cellarMemberships } from '../db/schema';

describe('createInvitation', () => {
  it('crée une invitation en attente avec une date d’expiration future', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'owner@example.com',
      password: 'x',
      cellarName: 'Cave',
    });

    const { id, token } = await createInvitation(db, {
      cellarId,
      email: 'invite@example.com',
      role: 'editor',
      invitedByUserId: userId,
    });

    const [row] = await db.select().from(invitations).where(eq(invitations.id, id));
    expect(row.status).toBe('pending');
    expect(row.token).toBe(token);
    expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('getInvitationByToken', () => {
  it('retourne "valid" pour une invitation en attente et non expirée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const { token } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'reader', invitedByUserId: userId });

    const lookup = await getInvitationByToken(db, token);
    expect(lookup.status).toBe('valid');
  });

  it('retourne "not_found" pour un token inconnu', async () => {
    const db = await createTestDb();
    expect((await getInvitationByToken(db, 'inconnu')).status).toBe('not_found');
  });

  it('retourne "expired" pour une invitation expirée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const { token, id } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'reader', invitedByUserId: userId });
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(invitations.id, id));

    expect((await getInvitationByToken(db, token)).status).toBe('expired');
  });

  it('retourne "already_used" pour une invitation déjà acceptée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const { token, id } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'reader', invitedByUserId: userId });
    await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, id));

    expect((await getInvitationByToken(db, token)).status).toBe('already_used');
  });
});

describe('acceptInvitation', () => {
  it('crée le membership avec le rôle de l’invitation et marque celle-ci acceptée', async () => {
    const db = await createTestDb();
    const { userId: ownerId, cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { token, id } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'editor', invitedByUserId: ownerId });
    const inviteeId = await createUserAccount(db, 'invite@example.com', 'x');

    const result = await acceptInvitation(db, token, inviteeId);
    expect(result.cellarId).toBe(cellarId);

    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.userId, inviteeId));
    expect(membership.role).toBe('editor');
    expect(membership.cellarId).toBe(cellarId);

    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id));
    expect(invitation.status).toBe('accepted');
  });

  it('rejette un token invalide', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    await expect(acceptInvitation(db, 'inconnu', userId)).rejects.toThrow();
  });
});
