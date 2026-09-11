import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { invitations, cellarMemberships } from '../db/schema';
import { newId } from '../db/id';
import { generateToken } from './token';

export const createInvitationBodySchema = z
  .object({
    cellarId: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['editor', 'reader']),
  })
  .strict();

export interface CreateInvitationInput {
  cellarId: string;
  email: string;
  role: 'editor' | 'reader';
  invitedByUserId: string;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(
  db: Db,
  input: CreateInvitationInput,
): Promise<{ id: string; token: string }> {
  const id = newId();
  const token = generateToken();
  const now = new Date();
  await db.insert(invitations).values({
    id,
    cellarId: input.cellarId,
    email: input.email.toLowerCase(),
    role: input.role,
    token,
    status: 'pending',
    invitedByUserId: input.invitedByUserId,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  });
  return { id, token };
}

type InvitationRow = typeof invitations.$inferSelect;

export type InvitationLookup =
  | { status: 'valid'; invitation: InvitationRow }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_used' };

export async function getInvitationByToken(db: Db, token: string): Promise<InvitationLookup> {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  if (!invitation) return { status: 'not_found' };
  if (invitation.status === 'accepted') return { status: 'already_used' };
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return { status: 'expired' };
  return { status: 'valid', invitation };
}

export async function acceptInvitation(
  db: Db,
  token: string,
  userId: string,
): Promise<{ cellarId: string }> {
  const lookup = await getInvitationByToken(db, token);
  if (lookup.status !== 'valid') {
    throw new Error('Invitation invalide.');
  }

  const [existingMembership] = await db
    .select()
    .from(cellarMemberships)
    .where(
      and(
        eq(cellarMemberships.cellarId, lookup.invitation.cellarId),
        eq(cellarMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (existingMembership) {
    await db
      .update(cellarMemberships)
      .set({ role: lookup.invitation.role })
      .where(eq(cellarMemberships.id, existingMembership.id));
  } else {
    await db.insert(cellarMemberships).values({
      id: newId(),
      cellarId: lookup.invitation.cellarId,
      userId,
      role: lookup.invitation.role,
      createdAt: new Date().toISOString(),
    });
  }
  await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, lookup.invitation.id));

  return { cellarId: lookup.invitation.cellarId };
}
