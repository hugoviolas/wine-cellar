import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listConsumptionHistory } from '@/domain/history';

export default async function HistoriquePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  const entries = membership ? await listConsumptionHistory(db, membership.cellarId) : [];

  return (
    <div>
      <h2 className="text-lg mb-4">Historique</h2>
      <ul className="bg-white rounded divide-y divide-gray-100">
        {entries.map((entry) => (
          <li key={entry.id} className="px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="font-serif italic">{entry.bottleNameSnapshot}</span>
              <span className="text-xs text-gray-500">{entry.consumedAt}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {entry.occasion && <span>{entry.occasion} · </span>}
              {entry.rating != null && <span>Note {entry.rating}/5</span>}
            </div>
            {entry.comment && <p className="text-xs mt-1">{entry.comment}</p>}
          </li>
        ))}
        {entries.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Aucune consommation enregistrée.</li>}
      </ul>
    </div>
  );
}
