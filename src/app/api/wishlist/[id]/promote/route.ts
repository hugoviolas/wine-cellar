import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import {
  resolveWishlistItemAccess,
  promoteWishlistItem,
  promoteWishlistItemBodySchema,
} from '@/domain/wishlist';
import { readJsonBody } from '@/lib/readJsonBody';

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  const access = await resolveWishlistItemAccess(db, auth.user.id, id);
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (access.item.status !== 'pending') {
    return NextResponse.json({ error: 'Cet item a déjà été ajouté à une cave.' }, { status: 409 });
  }

  const rawBody = await readJsonBody(request);
  const parsed = promoteWishlistItemBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const crate = await getCrateById(db, parsed.data.crateId);
  if (!crate) {
    return NextResponse.json({ error: 'Clayette introuvable.' }, { status: 404 });
  }
  const cellarAccess = await checkCellarAccess(db, auth.user.id, crate.cellarId);
  if (!cellarAccess.allowed || !canEditCellarContent(cellarAccess.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const { bottleId } = await promoteWishlistItem(db, access.item, parsed.data);
  return NextResponse.json({ bottleId });
};
