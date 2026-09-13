import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveWishlistItemAccess, listPromotionTargets } from '@/domain/wishlist';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { AiAnalysisButton } from '@/components/AiAnalysisButton';
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
  const promotionTargets = (item.status === 'pending' ? await listPromotionTargets(db, user.id) : []).filter(
    (target) => target.crates.length > 0,
  );
  // Génération proposée seulement tant que l'item est en attente : une fois
  // promu, c'est la fiche bouteille qui porte l'analyse et sa régénération.
  const aiAvailable = item.status === 'pending' && (await isAiAvailableForUser(db, user.id));
  const pairings = Array.isArray(item.aiPairings) ? (item.aiPairings as string[]) : [];

  return (
    <div className="max-w-md">
      <Link href="/wishlist" className="text-xs text-forest mb-2 inline-block">← Retour à la wishlist</Link>
      <h2 className="text-xl mb-1">{item.name}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {item.vintage ?? 'NV'} · {item.region ?? '—'} · {CATEGORY_LABELS[item.category] ?? item.category}
      </p>

      {item.comment && (
        <p className="bg-white rounded p-4 text-sm whitespace-pre-wrap mb-6">{item.comment}</p>
      )}

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
              Tu n&apos;as pas encore de clayette disponible dans une cave où tu peux ajouter des bouteilles.
            </p>
          ) : (
            <WishlistPromoteForm itemId={item.id} targets={promotionTargets} />
          )}
        </section>
      )}

      {aiAvailable && (
        <AiAnalysisButton
          endpoint={`/api/wishlist/${item.id}/ai-generate`}
          hasAnalysis={Boolean(item.aiGeneratedAt)}
        />
      )}

      {(item.drinkFrom || item.drinkUntil) && (
        <p className="text-xs text-gray-500 mb-6">
          Fenêtre de garde : {item.drinkFrom ?? '?'} – {item.drinkUntil ?? '?'}
        </p>
      )}

      {item.aiAnalysis && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Analyse</h4>
          <p className="text-sm italic font-serif">{item.aiAnalysis}</p>
        </section>
      )}

      {pairings.length > 0 && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Accords mets-vin</h4>
          <div className="flex flex-wrap gap-2">
            {pairings.map((pairing, index) => (
              <span key={`${index}-${pairing}`} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
                {pairing}
              </span>
            ))}
          </div>
        </section>
      )}

      {item.aiTastingAdvice && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Conseils de dégustation</h4>
          <p className="text-sm italic font-serif">{item.aiTastingAdvice}</p>
        </section>
      )}

      {(item.aiAnalysis || pairings.length > 0 || item.aiTastingAdvice) && (
        <p className="text-xs text-gray-400 mb-6">
          Analyse générée par IA — à vérifier, notamment sur les détails pointus (appellation, cépages...).
        </p>
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
          comment: item.comment,
        }}
      />
    </div>
  );
}
