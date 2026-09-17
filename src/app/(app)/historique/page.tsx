import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { listConsumptionHistory } from '@/domain/history';
import { HistoryEntryActions } from '@/components/HistoryEntryActions';
import { factLine } from '@/lib/stringArray';
import type { ReactElement } from 'react';

const HistoriquePage = async (): Promise<ReactElement> => {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  const entries = membership ? await listConsumptionHistory({ db, cellarId: membership.cellarId }) : [];
  const access = membership
    ? await checkCellarAccess({ db, userId: user.id, cellarId: membership.cellarId })
    : { allowed: false as const };
  const canEdit = access.allowed && canEditCellarContent(access.role);

  return (
    <div>
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">
        ← Retour à la cave
      </Link>
      <h2 className="text-lg mb-4">Historique</h2>
      <ul className="bg-white rounded divide-y divide-gray-100">
        {entries.map((entry) => {
          // Le producteur et le millésime étaient déjà figés en base à la
          // consommation, mais jamais affichés : deux homonymes de millésimes
          // différents se confondaient dans la liste.
          const meta = factLine([
            entry.bottleProducerSnapshot,
            entry.bottleVintageSnapshot,
            entry.quantity > 1 ? `×${entry.quantity}` : null,
            entry.occasion,
            entry.rating !== null ? `Note ${entry.rating}/5` : null,
          ]);
          const content = (
            <>
              <div className="flex justify-between">
                <span className="font-serif italic">{entry.bottleNameSnapshot}</span>
                <span className="text-xs text-gray-500">{entry.consumedAt}</span>
              </div>
              {meta && <div className="text-xs text-gray-500 mt-1">{meta}</div>}
              {entry.comment && <p className="text-xs mt-1">{entry.comment}</p>}
            </>
          );
          return (
            <li key={entry.id} className="text-sm px-4 py-3">
              {entry.bottleId && entry.bottleReachable ? (
                <Link
                  href={`/bottles/${entry.bottleId}`}
                  className="block hover:bg-gray-50 -mx-4 -my-3 px-4 py-3"
                >
                  {content}
                </Link>
              ) : (
                <div>{content}</div>
              )}
              {canEdit && (
                <HistoryEntryActions
                  entryId={entry.id}
                  initial={{
                    consumedAt: entry.consumedAt,
                    quantity: entry.quantity,
                    rating: entry.rating,
                    occasion: entry.occasion,
                    comment: entry.comment,
                  }}
                />
              )}
            </li>
          );
        })}
        {entries.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">Aucune consommation enregistrée.</li>
        )}
      </ul>
    </div>
  );
};

export default HistoriquePage;
