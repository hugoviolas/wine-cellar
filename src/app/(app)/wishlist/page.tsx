import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { listWishlistItems } from '@/domain/wishlist';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { wineColorDotClass } from '@/lib/wineColor';

export default async function WishlistPage() {
  const user = await requireUser();
  const items = await listWishlistItems(db, user.id);
  const pending = items.filter((item) => item.status === 'pending');
  const promoted = items.filter((item) => item.status === 'promoted');

  return (
    <div>
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl">Wishlist</h2>
        <Link href="/wishlist/ajouter" className="bg-forest text-cream rounded px-3 py-1.5 text-sm">
          + Ajouter
        </Link>
      </div>

      <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">À trouver</h3>
      {pending.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">Aucune bouteille en attente.</p>
      ) : (
        <ul className="bg-white rounded divide-y divide-gray-100 mb-6">
          {pending.map((item) => (
            <li key={item.id} className="text-sm">
              <Link href={`/wishlist/${item.id}`} className="block px-4 py-3 hover:bg-gray-50">
                <span className="flex items-center gap-2">
                  <span className={`w-[3px] h-3.5 rounded-sm shrink-0 ${wineColorDotClass(item.color)}`} />
                  <span className="font-serif italic">{item.name}</span>
                  <span className="text-xs text-gray-500">
                    {item.vintage ?? 'NV'} · {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </span>
                {/* `line-clamp-1` plutôt qu'une troncature côté serveur : le
                    commentaire complet reste dans le DOM pour la fiche, et la
                    largeur disponible varie selon l'écran. */}
                {item.comment && (
                  <span className="block text-xs text-gray-500 line-clamp-1 mt-0.5 pl-[11px]">
                    {item.comment}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {promoted.length > 0 && (
        <>
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Déjà en cave</h3>
          <ul className="bg-white rounded divide-y divide-gray-100">
            {promoted.map((item) => (
              <li key={item.id} className="text-sm px-4 py-3">
                {item.promotedBottleId ? (
                  <Link href={`/bottles/${item.promotedBottleId}`} className="flex items-center gap-2 hover:underline">
                    <span className={`w-[3px] h-3.5 rounded-sm shrink-0 ${wineColorDotClass(item.color)}`} />
                    <span className="font-serif italic">{item.name}</span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className={`w-[3px] h-3.5 rounded-sm shrink-0 ${wineColorDotClass(item.color)}`} />
                    <span className="font-serif italic text-gray-400">{item.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
