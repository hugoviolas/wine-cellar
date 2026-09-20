import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { CaveMap } from '@/components/CaveMap';
import type { BottleForMap } from '@/domain/wineMap';
import type { ReactElement } from 'react';

const CartePage = async ({
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

  // La géographie est déjà canonique en base (`resolveWineGeography` la
  // résout à chaque écriture) : la carte lit `region`/`subRegion` telles
  // quelles, sans rien recalculer.
  const bottles: BottleForMap[] = bottleRows.map((row) => ({
    id: row.bottle.id,
    name: row.bottle.name,
    producer: row.bottle.producer,
    vintage: row.bottle.vintage,
    color: row.bottle.color,
    quantity: row.bottle.quantity,
    region: row.bottle.region,
    subRegion: row.bottle.subRegion,
  }));

  return (
    <div>
      <Link href={`/cave${cellarQuery}`} className="text-xs text-forest mb-2 inline-block">
        ← Retour à la cave
      </Link>
      <h2 className="text-lg mb-4">Carte de la cave</h2>
      <CaveMap bottles={bottles} />
    </div>
  );
};

export default CartePage;
