import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { db } from '@/db/client';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { canEditCellarContent } from '@/domain/permissions';
import {
  BottleMoveError,
  moveBottles,
  moveBottlesBodySchema,
  type BottleMoveFailure,
} from '@/domain/bottles';
import { readJsonBody } from '@/lib/readJsonBody';

const STATUS_BY_FAILURE: Record<BottleMoveFailure, number> = {
  bottle_not_found: 404,
  crate_not_found: 404,
  other_cellar: 400,
  same_crate: 400,
  invalid_quantity: 400,
  insufficient_stock: 409,
};

/**
 * Déplace tout ou partie du stock d'une bouteille vers une autre clayette
 * (voir `moveBottles`). Répond `{ bottleId, merged }` : le lot qui contient
 * désormais les bouteilles dans la clayette cible, et s'il existait déjà
 * (fusion avec un lot du même vin).
 */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const access = await resolveBottleAccess({ db, userId: auth.user.id, bottleId: id });
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const parsed = moveBottlesBodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  try {
    const result = await moveBottles({
      db,
      bottleId: id,
      toCrateId: parsed.data.crateId,
      quantity: parsed.data.quantity,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BottleMoveError) {
      return NextResponse.json({ error: err.message }, { status: STATUS_BY_FAILURE[err.reason] });
    }
    throw err;
  }
};
