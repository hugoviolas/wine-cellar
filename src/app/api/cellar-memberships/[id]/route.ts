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
import { readJsonBody } from '@/lib/readJsonBody';
import type { RequireManageAccessArgs } from './interfaces/require-manage-access-args.interface';

type ManageAccessResult = { cellarId: string; error: null } | { cellarId: null; error: NextResponse };

const updateRoleBodySchema = z.object({ role: z.enum(['editor', 'reader']) }).strict();

const requireManageAccess = async ({
  userId,
  membershipId,
}: RequireManageAccessArgs): Promise<ManageAccessResult> => {
  const membership = await getMembershipById({ db, membershipId });
  if (!membership) {
    return { cellarId: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  const access = await checkCellarAccess({ db, userId, cellarId: membership.cellarId });
  if (!access.allowed || !canManageCellar(access.role)) {
    return { cellarId: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { cellarId: membership.cellarId, error: null };
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const { error } = await requireManageAccess({ userId: auth.user.id, membershipId: id });
  if (error) {
    return error;
  }

  const rawBody = await readJsonBody(request);
  const parsed = updateRoleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  try {
    await updateMembershipRole({ db, membershipId: id, role: parsed.data.role });
  } catch (err) {
    if (err instanceof CannotModifyOwnerError) {
      return NextResponse.json(
        { error: 'Le rôle du propriétaire ne peut pas être modifié.' },
        { status: 400 },
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const { error } = await requireManageAccess({ userId: auth.user.id, membershipId: id });
  if (error) {
    return error;
  }

  try {
    await removeMembership({ db, membershipId: id });
  } catch (err) {
    if (err instanceof CannotModifyOwnerError) {
      return NextResponse.json({ error: 'Le propriétaire ne peut pas être retiré.' }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
};
