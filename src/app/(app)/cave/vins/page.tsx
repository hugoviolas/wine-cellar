import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { buildWineList } from '@/domain/wineList';
import { WineListView } from '@/components/WineListView';
import type { ReactElement } from 'react';

const VinsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ cellarId?: string }>;
}): Promise<ReactElement> => {
  const user = await requireUser();
  const { cellarId: requestedCellarId } = await searchParams;
  const cellarId = await resolveViewedCellarId({ db, userId: user.id, requestedCellarId });
  const cellarQuery = requestedCellarId ? `?cellarId=${cellarId}` : '';

  if (!cellarId) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const bottleRows = await listActiveBottlesByCellar({ db, cellarId });
  const rows = buildWineList({ rows: bottleRows, currentYear: new Date().getFullYear() });

  return (
    <div>
      <Link href={`/cave${cellarQuery}`} className="text-xs text-forest mb-2 inline-block">
        ← Retour à la cave
      </Link>
      <h2 className="text-lg mb-4">Liste des vins</h2>
      <WineListView rows={rows} />
    </div>
  );
};

export default VinsPage;
