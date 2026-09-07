import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { computeGardeStatus } from '@/domain/gardeStatus';
import { WineListView, type WineListRow } from '@/components/WineListView';

export default async function VinsPage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  if (!membership) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const bottleRows = await listActiveBottlesByCellar(db, membership.cellarId);
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
    gardeStatus: computeGardeStatus(row.bottle.drinkFrom, row.bottle.drinkUntil, currentYear),
    createdAt: row.bottle.createdAt,
  }));

  return (
    <div>
      <h2 className="text-lg mb-4">Liste des vins</h2>
      <WineListView rows={rows} />
    </div>
  );
}
