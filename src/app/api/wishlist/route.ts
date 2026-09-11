import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { createWishlistItem, createWishlistItemBodySchema } from '@/domain/wishlist';

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = createWishlistItemBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  try {
    const id = await createWishlistItem(db, { ...parsed.data, userId: auth.user.id });
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'Détails invalides pour cette catégorie' }, { status: 400 });
  }
}
