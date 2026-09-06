import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getBottle } from '@/domain/bottles';
import { computeGardeStatus, computeGardeProgress } from '@/domain/gardeStatus';
import { GardeBadge } from '@/components/GardeBadge';
import { GardeGauge } from '@/components/GardeGauge';
import { UserNoteEditor } from '@/components/UserNoteEditor';

export default async function BottleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bottle = await getBottle(db, id);
  if (!bottle) notFound();

  const currentYear = new Date().getFullYear();
  const status = computeGardeStatus(bottle.drinkFrom, bottle.drinkUntil, currentYear);
  const progress = computeGardeProgress(bottle.vintage, bottle.drinkUntil, currentYear);

  return (
    <div className="max-w-lg">
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <h2 className="text-xl mb-1">{bottle.name}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {bottle.vintage ?? 'NV'} · {bottle.region ?? '—'} · {bottle.category}
      </p>

      <div className="flex gap-2 mb-6">
        <GardeBadge status={status} />
        <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
          {bottle.quantity} bouteille{bottle.quantity > 1 ? 's' : ''} en cave
        </span>
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

      {bottle.aiAnalysis && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Analyse</h4>
          <p className="text-sm italic font-serif">{bottle.aiAnalysis}</p>
        </section>
      )}

      {bottle.aiTastingAdvice && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Conseils de dégustation</h4>
          <p className="text-sm italic font-serif">{bottle.aiTastingAdvice}</p>
        </section>
      )}

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ta note</h4>
        <UserNoteEditor bottleId={bottle.id} initialNote={bottle.userNote} />
      </section>

      <a
        href={`/bottles/${bottle.id}/consommer`}
        className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Consommer une bouteille
      </a>
    </div>
  );
}
