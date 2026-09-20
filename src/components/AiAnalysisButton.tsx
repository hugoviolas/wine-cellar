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
type Phase = 'idle' | 'analysis' | 'price';

export const AiAnalysisButton = ({
  endpoint,
  priceEndpoint,
  hasAnalysis,
}: {
  endpoint: string;
  /**
   * Route d'estimation de prix, quand la fiche en a une. Elle est appelée
   * après l'analyse et non à sa place : elle interroge la recherche web,
   * donc elle est bien plus lente, et l'analyse n'a aucune raison de
   * l'attendre pour s'afficher.
   */
  priceEndpoint?: string;
  hasAnalysis: boolean;
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const busy = phase !== 'idle';

  /** `null` en cas d'échec — le message a déjà été affiché à l'utilisateur. */
  const post = async ({ url, fallback }: { url: string; fallback: string }): Promise<Response | null> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CLIENT_TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: 'POST', signal: abort.signal });
      if (!response.ok) {
        toast.error(await errorMessageFromResponse({ response, fallback }));
        return null;
      }
      return response;
    } catch (error: unknown) {
      // Un abandon n'est pas une panne : le dire tel quel évite de faire
      // chercher un problème d'API là où il n'y a qu'une attente trop longue.
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      toast.error(aborted ? 'Cela prend trop de temps. Réessaie dans un moment.' : fallback);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const generate = async (): Promise<void> => {
    setPhase('analysis');
    try {
      const analysis = await post({ url: endpoint, fallback: "Impossible de générer l'analyse IA." });
      if (!analysis) {
        return;
      }
      toast.success('Analyse IA générée.');
      // Rafraîchi avant la recherche de prix, pas après : c'est tout
      // l'intérêt de la séparation, l'analyse s'affiche sans attendre.
      router.refresh();

      if (!priceEndpoint) {
        return;
      }
      setPhase('price');
      // L'échec de l'estimation n'annule pas l'analyse, déjà enregistrée :
      // son message suffit, et la fiche reste juste sans prix.
      const price = await post({ url: priceEndpoint, fallback: "Le prix n'a pas pu être estimé." });
      if (price) {
        router.refresh();
      }
    } finally {
      setPhase('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void generate()}
      disabled={busy}
      className="border border-forest text-forest rounded px-3 py-2 text-sm mb-6"
    >
      {phase === 'analysis' && 'Génération…'}
      {phase === 'price' && 'Recherche du prix…'}
      {phase === 'idle' && (hasAnalysis ? "Régénérer l'analyse IA" : "Générer l'analyse IA")}
    </button>
  );
};
