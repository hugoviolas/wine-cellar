import { factLine } from '@/lib/stringArray';
import type { ConsumptionEntry } from './interfaces/consumption-entry.interface';
import type { ReactElement } from 'react';

/**
 * Les consommations passées d'une bouteille, sur sa fiche.
 *
 * Le commentaire de dégustation n'était visible que dans l'historique
 * global : en ouvrant la bouteille, ce qu'on avait justement noté en la
 * buvant disparaissait. Il est ici le contenu principal de chaque entrée —
 * date, quantité, note et occasion tiennent sur la ligne de contexte
 * au-dessus, comme dans l'historique.
 */
export const ConsumptionList = ({ entries }: { entries: readonly ConsumptionEntry[] }): ReactElement => {
  return (
    <ul className="bg-white rounded divide-y divide-gray-100">
      {entries.map((entry) => {
        const meta = factLine([
          entry.quantity > 1 ? `×${entry.quantity}` : null,
          entry.occasion,
          entry.rating !== null ? `Note ${entry.rating}/5` : null,
        ]);
        return (
          <li key={entry.id} className="px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-xs text-gray-500">{entry.consumedAt}</span>
              {meta && <span className="text-xs text-gray-500">{meta}</span>}
            </div>
            {entry.comment && <p className="mt-1 italic font-serif">{entry.comment}</p>}
          </li>
        );
      })}
    </ul>
  );
};
