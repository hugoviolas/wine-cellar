import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { listConsumptionHistory } from '@/domain/history';
import { computeGardeStatus } from '@/domain/gardeStatus';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';

export default async function AccueilPage() {
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
  const history = await listConsumptionHistory(db, membership.cellarId);
  const currentYear = new Date().getFullYear();

  const totalBottles = bottleRows.reduce((sum, row) => sum + row.bottle.quantity, 0);
  const countByCategory: Record<string, number> = {};
  for (const row of bottleRows) {
    countByCategory[row.bottle.category] = (countByCategory[row.bottle.category] ?? 0) + row.bottle.quantity;
  }

  const closingWindow = bottleRows.filter(
    (row) => computeGardeStatus(row.bottle.drinkFrom, row.bottle.drinkUntil, currentYear) === 'closing_window',
  );

  const recentHistory = history.slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-lg">Accueil</h2>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Stats globales</h3>
        <div className="bg-white rounded p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span><strong>{totalBottles}</strong> bouteille{totalBottles > 1 ? 's' : ''} en cave</span>
          {Object.entries(countByCategory).map(([category, count]) => (
            <span key={category} className="text-gray-500">
              {CATEGORY_LABELS[category] ?? category} : {count}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">À boire bientôt</h3>
        <div className="bg-white rounded divide-y divide-gray-100">
          {closingWindow.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">Rien à boire en priorité pour l’instant.</p>
          )}
          {closingWindow.map((row) => (
            <Link
              key={row.bottle.id}
              href={`/bottles/${row.bottle.id}`}
              className="block px-4 py-3 text-sm hover:bg-gray-50"
            >
              {row.bottle.name} <span className="text-xs text-gray-500">({row.bottle.vintage ?? 'NV'})</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Activité récente</h3>
        <div className="bg-white rounded divide-y divide-gray-100">
          {recentHistory.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">Aucune consommation enregistrée.</p>
          )}
          {recentHistory.map((entry) => {
            const content = (
              <div className="flex justify-between">
                <span>{entry.bottleNameSnapshot}</span>
                <span className="text-xs text-gray-500">{entry.consumedAt}</span>
              </div>
            );
            return (
              <div key={entry.id} className="text-sm">
                {entry.bottleId && entry.bottleReachable ? (
                  <Link href={`/bottles/${entry.bottleId}`} className="block px-4 py-3 hover:bg-gray-50">
                    {content}
                  </Link>
                ) : (
                  <div className="px-4 py-3">{content}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Accès rapides</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/cave/ajouter" className="bg-forest text-cream rounded px-3 py-1.5">
            + Ajouter une bouteille
          </Link>
          <Link href="/cave/clayettes" className="border border-forest text-forest rounded px-3 py-1.5">
            Gérer les clayettes
          </Link>
          <Link href="/historique" className="border border-forest text-forest rounded px-3 py-1.5">
            Voir l’historique
          </Link>
        </div>
      </section>
    </div>
  );
}
