'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crateLabel } from '@/lib/crateLabel';
import { useToast } from '@/components/Toast';
import type { CrateOption } from './interfaces/crate-option.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import { bottleMoveMessage, requestBottleMove } from '@/lib/bottleMove';
import { QuantityStepper } from './QuantityStepper';
import type { ReactElement } from 'react';

export const BottleActions = ({
  bottleId,
  otherCrates,
  initialQuantity,
  sameWineQuantityByCrate,
}: {
  bottleId: string;
  otherCrates: CrateOption[];
  initialQuantity: number;
  /** Clayettes qui contiennent déjà un lot de ce vin, et sa quantité. */
  sameWineQuantityByCrate: Record<string, number>;
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [targetCrateId, setTargetCrateId] = useState(otherCrates[0]?.id ?? '');
  const [quantity, setQuantity] = useState(initialQuantity);
  // Par défaut tout le stock, comme avant l'ajout de ce choix.
  const [moveCount, setMoveCount] = useState(initialQuantity);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const updateQuantity = async (): Promise<void> => {
    if (quantity === initialQuantity || quantity < 0) {
      return;
    }
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
    setBusy(false);
    if (!response.ok) {
      const message = await errorMessageFromResponse({
        response,
        fallback: 'Impossible de mettre à jour la quantité.',
      });
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Quantité mise à jour.');
    router.refresh();
  };

  // Un stock de 0 ou 1 n'a rien à scinder : la ligne part entière, sans
  // demander de nombre.
  const canSplit = initialQuantity > 1;
  const isMoveCountValid =
    !canSplit || (Number.isInteger(moveCount) && moveCount >= 1 && moveCount <= initialQuantity);

  const moveBottle = async (): Promise<void> => {
    if (!targetCrateId || !isMoveCountValid) {
      return;
    }
    const movedQuantity = canSplit ? moveCount : initialQuantity;
    const isPartial = movedQuantity < initialQuantity;
    const target = otherCrates.find((crate) => crate.id === targetCrateId);
    const targetLabel = target ? crateLabel({ number: target.number, name: target.name }) : 'la clayette';
    setError(null);
    setBusy(true);
    const outcome = await requestBottleMove({
      bottleId,
      crateId: targetCrateId,
      quantity: isPartial ? movedQuantity : undefined,
    });
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      toast.error(outcome.message);
      return;
    }
    toast.success(
      bottleMoveMessage({
        quantity: movedQuantity,
        merged: outcome.result?.merged ?? false,
        targetLabel,
      }),
    );
    if (isPartial) {
      // Le reste du stock est toujours ici : on reste sur la fiche, pour
      // pouvoir répartir le lot sur une autre clayette dans la foulée.
      router.refresh();
      return;
    }
    // Tout le stock est parti — et la fiche elle-même a disparu s'il a
    // rejoint un lot existant.
    router.push('/cave');
    router.refresh();
  };

  const removeBottle = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/bottles/${bottleId}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) {
      const message = await errorMessageFromResponse({
        response,
        fallback: 'Impossible de supprimer cette bouteille.',
      });
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Bouteille supprimée.');
    router.push('/cave');
    router.refresh();
  };

  return (
    <section className="mb-6 space-y-4">
      <h3 className="text-sm text-gray-600 mb-1">Gérer le stock</h3>
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Quantité en stock</h4>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
          />
          <button
            type="button"
            onClick={() => void updateQuantity()}
            disabled={busy || quantity === initialQuantity || quantity < 0}
            className="border border-forest text-forest rounded px-3 py-2 text-sm"
          >
            Mettre à jour la quantité
          </button>
        </div>
      </div>

      {otherCrates.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Déplacer vers</h4>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={targetCrateId}
              onChange={(e) => setTargetCrateId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm sm:flex-1"
            >
              {otherCrates.map((crate) => (
                <option key={crate.id} value={crate.id}>
                  {crateLabel({ number: crate.number, name: crate.name })}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              {canSplit && (
                <QuantityStepper
                  value={moveCount}
                  max={initialQuantity}
                  onChange={setMoveCount}
                  label="Nombre de bouteilles à déplacer"
                />
              )}
              <button
                type="button"
                onClick={() => void moveBottle()}
                disabled={busy || !isMoveCountValid}
                className="border border-forest text-forest rounded px-3 py-2 text-sm"
              >
                Déplacer
              </button>
            </div>
          </div>
          {sameWineQuantityByCrate[targetCrateId] !== undefined && (
            <p className="text-xs text-sage mt-2">
              Ce vin est déjà dans cette clayette (×{sameWineQuantityByCrate[targetCrateId]}) : les bouteilles
              rejoindront ce lot.
            </p>
          )}
        </div>
      )}

      <div>
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Supprimer définitivement cette bouteille ?</span>
            <button
              type="button"
              onClick={() => void removeBottle()}
              disabled={busy}
              className="text-xs text-red-700 underline"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs text-gray-500 underline"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-red-700 underline"
          >
            Supprimer cette bouteille
          </button>
        )}
      </div>
    </section>
  );
};
