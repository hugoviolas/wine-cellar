import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { computeGardeStatus } from '@/domain/gardeStatus';
import { WineListView, type WineListRow } from '@/components/WineListView';
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
  const currentYear = new Date().getFullYear();

  const rows: WineListRow[] = bottleRows.map((row) => ({
    id: row.bottle.id,
    name: row.bottle.name,
    producer: row.bottle.producer,
    category: row.bottle.category,
    color: row.bottle.color,
    vintage: row.bottle.vintage,
    quantity: row.bottle.quantity,
    rating: row.bottle.rating,
    gardeStatus: computeGardeStatus({
      drinkFrom: row.bottle.drinkFrom,
      drinkUntil: row.bottle.drinkUntil,
      currentYear,
    }),
    createdAt: row.bottle.createdAt,
  }));

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
