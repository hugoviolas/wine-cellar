import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/requireApiUser';
import {
  renameCrate,
  updateCrateCapacity,
  deleteCrate,
  getCrateById,
  crateHasActiveBottles,
} from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { db } from '@/db/client';
import { readJsonBody } from '@/lib/readJsonBody';

/**
 * Schéma aligné sur celui de la création (`createCrateBodySchema`) : un nom
 * vide efface le nom (voir `renameCrate`), d'où l'absence de `min(1)`, mais
 * une longueur maximale, qu'un champ libre stocké tel quel doit toujours
 * avoir.
 */
const updateCrateBodySchema = z
  .object({
    name: z.string().max(200).optional(),
    capacity: z.number().int().positive().optional(),
  })
  .strict();

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { user } = auth;
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const parsed = updateCrateBodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs de mise à jour invalides.' }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  if (parsed.data.name !== undefined) {
    await renameCrate(db, id, parsed.data.name);
  }
  if (parsed.data.capacity !== undefined) {
    await updateCrateCapacity(db, id, parsed.data.capacity);
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
  const { user } = auth;
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  if (await crateHasActiveBottles(db, id)) {
    return NextResponse.json({ error: 'Cette clayette contient encore des bouteilles.' }, { status: 409 });
  }

  // Les bouteilles épuisées (quantité 0) restées rattachées à cette clayette
  // deviennent orphelines (crate_id à null) grâce à la clé étrangère en
  // ON DELETE SET NULL — leur historique de consommation reste intact.
  await deleteCrate(db, id);
  return NextResponse.json({ ok: true });
};
