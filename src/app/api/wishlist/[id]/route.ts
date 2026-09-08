import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import {
  resolveWishlistItemAccess,
  updateWishlistItem,
  updateWishlistItemBodySchema,
  deleteWishlistItem,
  type UpdateWishlistItemInput,
} from '@/domain/wishlist';
import { parseBottleDetails } from '@/domain/bottleCategories';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const access = await resolveWishlistItemAccess(db, auth.user.id, id);
  if (access.status === 'not_found') return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const rawBody = await request.json().catch(() => null);
  const parsed = updateWishlistItemBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs de mise à jour invalides.' }, { status: 400 });
  }

  const patch: UpdateWishlistItemInput = { ...parsed.data };
  if (parsed.data.details !== undefined) {
    try {
      patch.details = parseBottleDetails(access.item.category, parsed.data.details);
    } catch {
      return NextResponse.json({ error: 'Détails invalides pour cette catégorie.' }, { status: 400 });
    }
  }

  await updateWishlistItem(db, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const access = await resolveWishlistItemAccess(db, auth.user.id, id);
  if (access.status === 'not_found') return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  await deleteWishlistItem(db, id);
  return NextResponse.json({ ok: true });
}
