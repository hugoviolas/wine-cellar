import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { db } from '@/db/client';
import { updateBottle, deleteBottle, updateBottleBodySchema, type UpdateBottleInput } from '@/domain/bottles';
import { getCrateById } from '@/domain/crates';
import { canEditCellarContent } from '@/domain/permissions';
import { resolveBottleAccess, type BottleAccessResult } from '@/domain/bottleAccess';
import { parseBottleDetails } from '@/domain/bottleCategories';
import { readJsonBody } from '@/lib/readJsonBody';
import type { RequireBottleAccessArgs } from './interfaces/require-bottle-access-args.interface';

type BottleAccessOutcome =
  | {
      bottle: Extract<BottleAccessResult, { status: 'ok' }>['bottle'];
      role: Extract<BottleAccessResult, { status: 'ok' }>['role'];
      error: null;
    }
  | { bottle: null; role: null; error: NextResponse };

const requireBottleAccess = async ({
  userId,
  bottleId,
}: RequireBottleAccessArgs): Promise<BottleAccessOutcome> => {
  const result = await resolveBottleAccess({ db, userId, bottleId });
  if (result.status === 'not_found') {
    return { bottle: null, role: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  if (result.status === 'forbidden') {
    return { bottle: null, role: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { bottle: result.bottle, role: result.role, error: null };
};

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;
  const { bottle, error } = await requireBottleAccess({ userId: auth.user.id, bottleId: id });
  if (error) {
    return error;
  }
  return NextResponse.json(bottle);
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
  const { bottle, role, error } = await requireBottleAccess({ userId: auth.user.id, bottleId: id });
  if (error) {
    return error;
  }

  const rawBody = await readJsonBody(request);
  const parsed = updateBottleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs de mise à jour invalides.' }, { status: 400 });
  }
  const patchKeys = Object.keys(parsed.data);
  if (patchKeys.length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  // Un patch qui ne porte que sur la note personnelle et/ou la note sur 5
  // est ouvert à tout membre (y compris reader — voir la matrice de
  // permissions du spec : "Consommer une bouteille + noter"). Tout autre
  // champ, seul ou combiné à ceux-ci, reste réservé aux rôles pouvant
  // éditer le contenu de la cave.
  const personalFields = new Set(['userNote', 'rating']);
  const isPersonalOnlyPatch = patchKeys.every((key) => personalFields.has(key));
  if (!isPersonalOnlyPatch && !canEditCellarContent(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  if (parsed.data.crateId) {
    const currentCrate = await getCrateById({ db, crateId: bottle.crateId });
    const targetCrate = await getCrateById({ db, crateId: parsed.data.crateId });
    if (!targetCrate) {
      return NextResponse.json({ error: 'Clayette de destination introuvable.' }, { status: 404 });
    }
    if (!currentCrate || targetCrate.cellarId !== currentCrate.cellarId) {
      return NextResponse.json(
        { error: 'La clayette de destination doit appartenir à la même cave.' },
        { status: 400 },
      );
    }
  }

  const patch: UpdateBottleInput = { ...parsed.data };
  if (parsed.data.details !== undefined) {
    try {
      patch.details = parseBottleDetails(bottle.category, parsed.data.details);
    } catch {
      return NextResponse.json({ error: 'Détails invalides pour cette catégorie.' }, { status: 400 });
    }
  }

  await updateBottle({ db, bottleId: id, input: patch });
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
  const { role, error } = await requireBottleAccess({ userId: auth.user.id, bottleId: id });
  if (error) {
    return error;
  }
  if (!canEditCellarContent(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }
  await deleteBottle({ db, bottleId: id });
  return NextResponse.json({ ok: true });
};
