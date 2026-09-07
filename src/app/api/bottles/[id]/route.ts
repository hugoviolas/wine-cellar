import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { db } from '@/db/client';
import { updateBottle, deleteBottle, updateBottleBodySchema } from '@/domain/bottles';
import { getCrateById } from '@/domain/crates';
import { canEditCellarContent } from '@/domain/permissions';
import { resolveBottleAccess, type BottleAccessResult } from '@/domain/bottleAccess';

type BottleAccessOutcome =
  | { bottle: Extract<BottleAccessResult, { status: 'ok' }>['bottle']; role: Extract<BottleAccessResult, { status: 'ok' }>['role']; error: null }
  | { bottle: null; role: null; error: NextResponse };

async function requireBottleAccess(userId: string, bottleId: string): Promise<BottleAccessOutcome> {
  const result = await resolveBottleAccess(db, userId, bottleId);
  if (result.status === 'not_found') {
    return { bottle: null, role: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  if (result.status === 'forbidden') {
    return { bottle: null, role: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { bottle: result.bottle, role: result.role, error: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { bottle, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  return NextResponse.json(bottle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { bottle, role, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;

  const rawBody = await request.json().catch(() => null);
  const parsed = updateBottleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs de mise à jour invalides.' }, { status: 400 });
  }
  const patchKeys = Object.keys(parsed.data);
  if (patchKeys.length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  // Un patch qui ne porte que sur la note personnelle est ouvert à tout
  // membre (y compris reader — voir la matrice de permissions du spec :
  // "Consommer une bouteille + noter"). Tout autre champ, seul ou combiné à
  // userNote, reste réservé aux rôles pouvant éditer le contenu de la cave.
  const isNoteOnlyPatch = patchKeys.length === 1 && patchKeys[0] === 'userNote';
  if (!isNoteOnlyPatch && !canEditCellarContent(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  if (parsed.data.crateId) {
    // resolveBottleAccess ne renvoie 'ok' que pour une bouteille dont
    // crateId est non nul (voir bottleAccess.ts), donc bottle.crateId est
    // garanti non nul ici malgré son typage `string | null`.
    const currentCrate = await getCrateById(db, bottle.crateId as string);
    const targetCrate = await getCrateById(db, parsed.data.crateId);
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

  await updateBottle(db, id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { role, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  if (!canEditCellarContent(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }
  await deleteBottle(db, id);
  return NextResponse.json({ ok: true });
}
