import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import {
  getMembershipById,
  updateMembershipRole,
  removeMembership,
  CannotModifyOwnerError,
} from '@/domain/cellarMembers';

const updateRoleBodySchema = z.object({ role: z.enum(['editor', 'reader']) }).strict();

async function requireManageAccess(userId: string, membershipId: string) {
  const membership = await getMembershipById(db, membershipId);
  if (!membership) {
    return { cellarId: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  const access = await checkCellarAccess(db, userId, membership.cellarId);
  if (!access.allowed || !canManageCellar(access.role)) {
    return { cellarId: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { cellarId: membership.cellarId, error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const { error } = await requireManageAccess(auth.user.id, id);
  if (error) return error;

  const rawBody = await request.json().catch(() => null);
  const parsed = updateRoleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  try {
    await updateMembershipRole(db, id, parsed.data.role);
  } catch (err) {
    if (err instanceof CannotModifyOwnerError) {
      return NextResponse.json({ error: 'Le rôle du owner ne peut pas être modifié.' }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const { error } = await requireManageAccess(auth.user.id, id);
  if (error) return error;

  try {
    await removeMembership(db, id);
  } catch (err) {
    if (err instanceof CannotModifyOwnerError) {
      return NextResponse.json({ error: 'Le owner ne peut pas être retiré.' }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
