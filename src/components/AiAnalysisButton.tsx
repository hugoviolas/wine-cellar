'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

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
    try {
      const response = await fetch(endpoint, { method: 'POST' });
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
    } catch {
      toast.error("Impossible de générer l'analyse IA.");
    } finally {
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
      {busy ? 'Génération…' : hasAnalysis ? "Régénérer l'analyse IA" : "Générer l'analyse IA"}
    </button>
  );
};
