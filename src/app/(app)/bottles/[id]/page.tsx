import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { computeGardeStatus, computeGardeProgress } from '@/domain/gardeStatus';
import { getCrateById, listCrates } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { listBottleConsumptions } from '@/domain/history';
import { parseAiPriceEstimate } from '@/domain/ai/priceEstimate';
import { getGrapeVarieties, getAppellation, getClassification } from '@/domain/bottleCategories';
import { crateLabel } from '@/lib/crateLabel';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { GardeBadge } from '@/components/GardeBadge';
import { FactList } from '@/components/FactList';
import { GardeGauge } from '@/components/GardeGauge';
import { UserNoteEditor } from '@/components/UserNoteEditor';
import { BottleActions } from '@/components/BottleActions';
import { EditBottleForm } from '@/components/EditBottleForm';
import { AiAnalysisButton } from '@/components/AiAnalysisButton';
import { ConsumptionList } from '@/components/ConsumptionList';
import { PriceEstimate } from '@/components/PriceEstimate';
import { wineColorStripeClass } from '@/lib/wineColor';
import type { ReactElement } from 'react';
import { stringArrayOrEmpty } from '@/lib/stringArray';

const BottleDetailPage = async ({ params }: { params: Promise<{ id: string }> }): Promise<ReactElement> => {
  const user = await requireUser();
  const { id } = await params;
  const access = await resolveBottleAccess({ db, userId: user.id, bottleId: id });
  if (access.status !== 'ok') {
    notFound();
  }
  const bottle = access.bottle;

  const currentCrate = await getCrateById({ db, crateId: bottle.crateId });
  const siblingCrates = currentCrate
    ? (await listCrates({ db, cellarId: currentCrate.cellarId })).filter((c) => c.id !== currentCrate.id)
    : [];
  const cellar = currentCrate ? await getCellarById({ db, cellarId: currentCrate.cellarId }) : null;
  const aiAvailable = cellar ? isAiAvailable(cellar) : false;
  const pairings = stringArrayOrEmpty(bottle.aiPairings);
  const consumptions = await listBottleConsumptions({ db, bottleId: bottle.id });
  const priceEstimate = parseAiPriceEstimate(bottle.aiPriceEstimate);

  const currentYear = new Date().getFullYear();
  const status = computeGardeStatus({
    drinkFrom: bottle.drinkFrom,
    drinkUntil: bottle.drinkUntil,
    currentYear,
  });
  const progress = computeGardeProgress({
    vintage: bottle.vintage,
    drinkUntil: bottle.drinkUntil,
    currentYear,
  });

  const grapeVarieties = getGrapeVarieties({ category: bottle.category, details: bottle.details });
  const appellation = getAppellation({ category: bottle.category, details: bottle.details });
  const classification = getClassification({ category: bottle.category, details: bottle.details });

  // « NV » (non millésimé) est une convention du vin et de l'effervescent :
  // l'afficher sur une bière ou un spiritueux n'aurait aucun sens, la ligne
  // disparaît simplement.
  const hasVintageNotion = bottle.category === 'wine' || bottle.category === 'sparkling';

  const facts = [
    { label: 'Catégorie', value: CATEGORY_LABELS[bottle.category] ?? bottle.category },
    { label: 'Millésime', value: bottle.vintage ?? (hasVintageNotion ? 'NV' : null) },
    { label: 'Région', value: bottle.region },
    { label: 'Sous-région', value: bottle.subRegion },
    { label: 'Appellation', value: appellation },
    { label: 'Classement', value: classification },
    { label: 'Cépages', value: grapeVarieties.join(', ') },
    { label: 'Degré', value: bottle.abv !== null ? `${bottle.abv} %` : null },
    { label: 'Volume', value: bottle.volumeMl !== null ? `${bottle.volumeMl} ml` : null },
  ];

  return (
    <div className="max-w-lg">
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">
        ← Retour à la cave
      </Link>
      <div className={`pl-4 mb-6 ${wineColorStripeClass(bottle.color)}`}>
        <h2 className="text-xl mb-1">{bottle.name}</h2>
        {bottle.producer && <p className="text-sm text-gray-600 mb-3">{bottle.producer}</p>}

        {/*
          Ces trois-là ne décrivent pas le vin mais sa place dans ta cave :
          ils vont ensemble, et pas dans la liste des caractéristiques.
        */}
        <div className="flex flex-wrap gap-2 mb-4">
          <GardeBadge status={status} />
          {currentCrate && (
            <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
              {crateLabel({ number: currentCrate.number, name: currentCrate.name })}
            </span>
          )}
          <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
            {bottle.quantity} bouteille{bottle.quantity > 1 ? 's' : ''} en cave
          </span>
        </div>

        <FactList facts={facts} />
      </div>

      {/*
        `GardeGauge` ne rend rien sans fenêtre connue : sans cette garde, le
        titre de section restait seul au-dessus du vide (visible sur une
        bière, qui n'a pas de notion de garde).
      */}
      {bottle.drinkFrom !== null && bottle.drinkUntil !== null && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Fenêtre de garde</h4>
          <GardeGauge
            progress={progress}
            vintage={bottle.vintage}
            drinkFrom={bottle.drinkFrom}
            drinkUntil={bottle.drinkUntil}
          />
        </section>
      )}

      {aiAvailable && (
        <AiAnalysisButton
          endpoint={`/api/bottles/${bottle.id}/ai-generate`}
          priceEndpoint={`/api/bottles/${bottle.id}/ai-price`}
          hasAnalysis={Boolean(bottle.aiGeneratedAt)}
        />
      )}

      {bottle.aiAnalysis && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Analyse</h4>
          <p className="text-sm italic font-serif">{bottle.aiAnalysis}</p>
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

      {bottle.aiTastingAdvice && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Conseils de dégustation</h4>
          <p className="text-sm italic font-serif">{bottle.aiTastingAdvice}</p>
        </section>
      )}

      {priceEstimate && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Estimation de prix</h4>
          <PriceEstimate estimate={priceEstimate} generatedAt={bottle.aiGeneratedAt} />
        </section>
      )}

      {(bottle.aiAnalysis || pairings.length > 0 || bottle.aiTastingAdvice || priceEstimate) && (
        <p className="text-xs text-gray-400 mb-6">
          Analyse générée par IA — à vérifier, notamment sur les détails pointus (appellation, cépages...).
        </p>
      )}

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ta note</h4>
        <UserNoteEditor bottleId={bottle.id} initialNote={bottle.userNote} initialRating={bottle.rating} />
      </section>

      {/*
        L'historique de cette bouteille-là. Il ne s'affiche qu'une fois la
        première bouteille bue : sur une bouteille jamais ouverte, un titre
        au-dessus d'une liste vide n'apprend rien.
      */}
      {consumptions.length > 0 && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Consommations</h4>
          <ConsumptionList entries={consumptions} />
        </section>
      )}

      <section className="mb-6">
        <EditBottleForm
          bottle={{
            id: bottle.id,
            category: bottle.category,
            name: bottle.name,
            producer: bottle.producer,
            vintage: bottle.vintage,
            region: bottle.region,
            subRegion: bottle.subRegion,
            color: bottle.color,
            abv: bottle.abv,
            volumeMl: bottle.volumeMl,
            grapeVarieties,
            appellation,
            classification,
          }}
        />
      </section>

      <BottleActions bottleId={bottle.id} otherCrates={siblingCrates} initialQuantity={bottle.quantity} />

      <a
        href={`/bottles/${bottle.id}/consommer`}
        className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Consommer une bouteille
      </a>
    </div>
  );
};

export default BottleDetailPage;
