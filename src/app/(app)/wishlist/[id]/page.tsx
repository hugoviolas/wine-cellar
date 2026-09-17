import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveWishlistItemAccess, listPromotionTargets } from '@/domain/wishlist';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { AiAnalysisButton } from '@/components/AiAnalysisButton';
import { getGrapeVarieties, getAppellation, getClassification } from '@/domain/bottleCategories';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { FactList } from '@/components/FactList';
import { WishlistEditForm } from '@/components/WishlistEditForm';
import { WishlistPromoteForm } from '@/components/WishlistPromoteForm';
import type { ReactElement } from 'react';
import { stringArrayOrEmpty } from '@/lib/stringArray';

const WishlistItemPage = async ({ params }: { params: Promise<{ id: string }> }): Promise<ReactElement> => {
  const user = await requireUser();
  const { id } = await params;
  const access = await resolveWishlistItemAccess({ db, userId: user.id, itemId: id });
  if (access.status !== 'ok') {
    notFound();
  }
  const item = access.item;
  const promotionTargets = (
    item.status === 'pending' ? await listPromotionTargets({ db, userId: user.id }) : []
  ).filter((target) => target.crates.length > 0);
  // Génération proposée seulement tant que l'item est en attente : une fois
  // promu, c'est la fiche bouteille qui porte l'analyse et sa régénération.
  const aiAvailable = item.status === 'pending' && (await isAiAvailableForUser({ db, userId: user.id }));
  const pairings = stringArrayOrEmpty(item.aiPairings);
  const grapeVarieties = getGrapeVarieties({ category: item.category, details: item.details });
  const appellation = getAppellation({ category: item.category, details: item.details });
  const classification = getClassification({ category: item.category, details: item.details });
  const hasVintageNotion = item.category === 'wine' || item.category === 'sparkling';
  const facts = [
    { label: 'Catégorie', value: item.category === 'wine' ? null : CATEGORY_LABELS[item.category] },
    { label: 'Millésime', value: item.vintage ?? (hasVintageNotion ? 'NV' : null) },
    { label: 'Région', value: item.region },
    { label: 'Sous-région', value: item.subRegion },
    { label: 'Appellation', value: appellation },
    { label: 'Classement', value: classification },
    { label: 'Cépages', value: grapeVarieties.join(', ') },
  ];

  return (
    <div className="max-w-md">
      <Link href="/wishlist" className="text-xs text-forest mb-2 inline-block">
        ← Retour à la wishlist
      </Link>
      <h2 className="text-xl mb-1">{item.name}</h2>
      {item.producer && <p className="text-sm text-gray-600 mb-3">{item.producer}</p>}
      <div className="mb-6">
        <FactList facts={facts} />
      </div>

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
              <span
                key={`${index}-${pairing}`}
                className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1"
              >
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
          subRegion: item.subRegion,
          color: item.color,
          grapeVarieties,
          appellation,
          classification,
          comment: item.comment,
        }}
      />
    </div>
  );
};

export default WishlistItemPage;
