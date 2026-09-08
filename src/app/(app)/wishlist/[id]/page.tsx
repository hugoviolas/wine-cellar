import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveWishlistItemAccess, listPromotionTargets } from '@/domain/wishlist';
import { getGrapeVarieties, getAppellation } from '@/domain/bottleCategories';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { WishlistEditForm } from '@/components/WishlistEditForm';
import { WishlistPromoteForm } from '@/components/WishlistPromoteForm';

export default async function WishlistItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const access = await resolveWishlistItemAccess(db, user.id, id);
  if (access.status !== 'ok') notFound();
  const item = access.item;
  const promotionTargets = item.status === 'pending' ? await listPromotionTargets(db, user.id) : [];

  return (
    <div className="max-w-md">
      <Link href="/wishlist" className="text-xs text-forest mb-2 inline-block">← Retour à la wishlist</Link>
      <h2 className="text-xl mb-1">{item.name}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {item.vintage ?? 'NV'} · {item.region ?? '—'} · {CATEGORY_LABELS[item.category] ?? item.category}
      </p>

      {item.status === 'promoted' ? (
        item.promotedBottleId && (
          <Link
            href={`/bottles/${item.promotedBottleId}`}
            className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm mb-6"
          >
            Voir la bouteille
          </Link>
        )
      ) : (
        <section className="mb-6">
          <h3 className="text-sm mb-2">Ajouter à ma cave</h3>
          {promotionTargets.length === 0 ? (
            <p className="text-sm text-gray-500">
              Tu n&apos;as pas les droits pour ajouter des bouteilles dans une cave pour le moment.
            </p>
          ) : (
            <WishlistPromoteForm itemId={item.id} targets={promotionTargets} />
          )}
        </section>
      )}

      <WishlistEditForm
        item={{
          id: item.id,
          category: item.category,
          name: item.name,
          producer: item.producer,
          vintage: item.vintage,
          region: item.region,
          color: item.color,
          grapeVarieties: getGrapeVarieties(item.category, item.details),
          appellation: getAppellation(item.category, item.details),
        }}
      />
    </div>
  );
}
