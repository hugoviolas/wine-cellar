import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listCrates } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { AddBottleForm } from '@/components/AddBottleForm';

export default async function AddBottlePage({
  searchParams,
}: {
  searchParams: Promise<{ cellarId?: string }>;
}) {
  const user = await requireUser();
  const { cellarId: requestedCellarId } = await searchParams;
  const cellarId = await resolveViewedCellarId(db, user.id, requestedCellarId);
  const cellarQuery = requestedCellarId ? `?cellarId=${cellarId}` : '';

  const crates = cellarId ? await listCrates(db, cellarId) : [];
  const cellar = cellarId ? await getCellarById(db, cellarId) : null;
  const aiAvailable = cellar ? isAiAvailable(cellar) : false;

  return (
    <div>
      <Link href={`/cave${cellarQuery}`} className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <h2 className="text-lg mb-4">Ajouter une bouteille</h2>
      {crates.length === 0 || !cellarId ? (
        <p className="text-sm">Crée d’abord une clayette avant d’ajouter une bouteille.</p>
      ) : (
        <AddBottleForm crates={crates} cellarId={cellarId} aiAvailable={aiAvailable} />
      )}
    </div>
  );
}
