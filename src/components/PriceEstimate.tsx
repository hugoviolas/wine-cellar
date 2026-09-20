import type { AiPriceEstimate } from '@/domain/ai/schemas';
import type { ReactElement } from 'react';

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * Estimation de prix et ses sources.
 *
 * Les sources sont affichées, pas résumées : une estimation produite par
 * une IA ne vaut que ce que valent les pages qu'elle a réellement lues, et
 * la fiche doit permettre d'aller les vérifier. La date de génération est
 * rappelée pour la même raison — un prix du vin se périme.
 *
 * Rien à afficher quand l'estimation est absente : la fiche n'annonce pas
 * « prix introuvable », elle n'en parle simplement pas.
 */
export const PriceEstimate = ({
  estimate,
  generatedAt,
}: {
  estimate: AiPriceEstimate;
  generatedAt: string | null;
}): ReactElement => {
  const range =
    Math.round(estimate.lowEur) === Math.round(estimate.highEur)
      ? EUR.format(estimate.lowEur)
      : `${EUR.format(estimate.lowEur)} – ${EUR.format(estimate.highEur)}`;

  return (
    <div className="text-sm">
      <p className="font-serif">
        {range}
        {generatedAt && (
          <span className="text-xs text-gray-500"> · relevé le {generatedAt.slice(0, 10)}</span>
        )}
      </p>
      {estimate.note && <p className="text-xs text-gray-600 mt-1">{estimate.note}</p>}
      <ul className="text-xs text-gray-500 mt-2 space-y-0.5">
        {estimate.sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest underline underline-offset-2"
            >
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
