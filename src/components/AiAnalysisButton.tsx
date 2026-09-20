'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

/**
 * Au-delà de cette durée, on rend la main plutôt que de laisser le bouton
 * tourner. Un peu plus long que le budget côté serveur (voir
 * `CALL_BUDGET_MS`) : quand c'est lui qui expire, son message est plus
 * précis, et cette garde-ci ne sert qu'au cas où la réponse elle-même se
 * perd en route.
 */
const CLIENT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * `endpoint` plutôt qu'un `bottleId` : le même bouton sert la fiche
 * bouteille et la fiche wishlist, dont les routes de génération diffèrent
 * mais dont la réponse et l'effet (rafraîchir la page) sont identiques.
 */
export const AiAnalysisButton = ({
  endpoint,
  hasAnalysis,
}: {
  endpoint: string;
  hasAnalysis: boolean;
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const generate = async (): Promise<void> => {
    setBusy(true);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CLIENT_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, { method: 'POST', signal: abort.signal });
      if (!response.ok) {
        const message = await errorMessageFromResponse({
          response,
          fallback: "Impossible de générer l'analyse IA.",
        });
        toast.error(message);
        return;
      }
      toast.success('Analyse IA générée.');
      router.refresh();
    } catch (error: unknown) {
      // Un abandon n'est pas une panne : le dire tel quel évite de faire
      // chercher un problème d'API là où il n'y a qu'une attente trop longue.
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      toast.error(
        aborted
          ? "L'analyse IA prend trop de temps. Réessaie dans un moment."
          : "Impossible de générer l'analyse IA.",
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void generate()}
      disabled={busy}
      className="border border-forest text-forest rounded px-3 py-2 text-sm mb-6"
    >
      {busy ? 'Génération… (jusqu’à 1 min)' : hasAnalysis ? "Régénérer l'analyse IA" : "Générer l'analyse IA"}
    </button>
  );
};
