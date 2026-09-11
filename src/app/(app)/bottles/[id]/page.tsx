import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { computeGardeStatus, computeGardeProgress } from '@/domain/gardeStatus';
import { getCrateById, listCrates } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { getGrapeVarieties, getAppellation } from '@/domain/bottleCategories';
import { crateLabel } from '@/lib/crateLabel';
import { GardeBadge } from '@/components/GardeBadge';
import { GardeGauge } from '@/components/GardeGauge';
import { UserNoteEditor } from '@/components/UserNoteEditor';
import { BottleActions } from '@/components/BottleActions';
import { EditBottleForm } from '@/components/EditBottleForm';
import { AiAnalysisButton } from '@/components/AiAnalysisButton';
import { wineColorStripeClass } from '@/lib/wineColor';

export default async function BottleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const access = await resolveBottleAccess(db, user.id, id);
  if (access.status !== 'ok') notFound();
  const bottle = access.bottle;

  // bottle.crateId est garanti non nul : resolveBottleAccess exclut les
  // bouteilles orphelines (voir bottleAccess.ts).
  const currentCrate = await getCrateById(db, bottle.crateId as string);
  const siblingCrates = currentCrate
    ? (await listCrates(db, currentCrate.cellarId)).filter((c) => c.id !== currentCrate.id)
    : [];
  const cellar = currentCrate ? await getCellarById(db, currentCrate.cellarId) : null;
  const aiAvailable = cellar ? isAiAvailable(cellar) : false;
  const pairings = Array.isArray(bottle.aiPairings) ? (bottle.aiPairings as string[]) : [];

  const currentYear = new Date().getFullYear();
  const status = computeGardeStatus(bottle.drinkFrom, bottle.drinkUntil, currentYear);
  const progress = computeGardeProgress(bottle.vintage, bottle.drinkUntil, currentYear);

  const grapeVarieties = getGrapeVarieties(bottle.category, bottle.details);
  const appellation = getAppellation(bottle.category, bottle.details);

  return (
    <div className="max-w-lg">
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <div className={`pl-4 ${wineColorStripeClass(bottle.color)}`}>
      <h2 className="text-xl mb-1">{bottle.name}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {bottle.vintage ?? 'NV'} · {bottle.region ?? '—'} · {bottle.category} ·{' '}
        {currentCrate ? crateLabel(currentCrate.number, currentCrate.name) : '—'}
      </p>

      {(appellation || grapeVarieties.length > 0) && (
        <p className="text-xs text-gray-500 mb-4">
          {appellation}
          {appellation && grapeVarieties.length > 0 ? ' · ' : ''}
          {grapeVarieties.join(', ')}
        </p>
      )}

      <div className="flex gap-2 mb-6">
        <GardeBadge status={status} />
        <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
          {bottle.quantity} bouteille{bottle.quantity > 1 ? 's' : ''} en cave
        </span>
      </div>
      </div>

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Fenêtre de garde</h4>
        <GardeGauge
          progress={progress}
          vintage={bottle.vintage}
          drinkFrom={bottle.drinkFrom}
          drinkUntil={bottle.drinkUntil}
        />
      </section>

      {aiAvailable && (
        <AiAnalysisButton bottleId={bottle.id} hasAnalysis={Boolean(bottle.aiGeneratedAt)} />
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
              <span key={`${index}-${pairing}`} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
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

      {(bottle.aiAnalysis || pairings.length > 0 || bottle.aiTastingAdvice) && (
        <p className="text-xs text-gray-400 mb-6">
          Analyse générée par IA — à vérifier, notamment sur les détails pointus (appellation, cépages...).
        </p>
      )}

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ta note</h4>
        <UserNoteEditor bottleId={bottle.id} initialNote={bottle.userNote} initialRating={bottle.rating} />
      </section>

      <section className="mb-6">
        <EditBottleForm
          bottle={{
            id: bottle.id,
            category: bottle.category,
            name: bottle.name,
            producer: bottle.producer,
            vintage: bottle.vintage,
            region: bottle.region,
            color: bottle.color,
            abv: bottle.abv,
            volumeMl: bottle.volumeMl,
            grapeVarieties,
            appellation,
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
}
