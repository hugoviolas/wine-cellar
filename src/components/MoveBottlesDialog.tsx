'use client';

import { useEffect, useRef, useState } from 'react';
import { QuantityStepper } from './QuantityStepper';
import type { ReactElement } from 'react';

/**
 * Confirmation d'un glisser-déposer vers une autre clayette : choix du
 * nombre de bouteilles, et garde-fou contre un lâcher accidentel. `<dialog>`
 * natif : focus piégé, Échap et arrière-plan inerte sans code de plus.
 */
export const MoveBottlesDialog = ({
  bottleLabel,
  available,
  targetLabel,
  sameWineQuantity,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  bottleLabel: string;
  available: number;
  targetLabel: string;
  /** Quantité du lot du même vin déjà présent dans la clayette cible, sinon `null`. */
  sameWineQuantity: number | null;
  busy: boolean;
  error: string | null;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Tout le stock par défaut, comme sur la fiche bouteille.
  const [quantity, setQuantity] = useState(available);
  const isValid = Number.isInteger(quantity) && quantity >= 1 && quantity <= available;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    // `showModal` donne le focus au premier élément focusable (le « − ») :
    // on le place sur la confirmation, pour qu'Entrée valide directement.
    confirmRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const cancel = (): void => {
    if (!busy) {
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="move-bottles-title"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      onClick={(e) => {
        // Un clic sur l'arrière-plan atteint le <dialog> lui-même, jamais
        // son contenu (enveloppé dans le formulaire).
        if (e.target === e.currentTarget) {
          cancel();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded bg-white p-0 shadow-lg backdrop:bg-black/40"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isValid && !busy) {
            onConfirm(quantity);
          }
        }}
        className="p-5 space-y-4"
      >
        <div>
          <h3 id="move-bottles-title" className="text-lg italic">
            Déplacer vers {targetLabel}
          </h3>
          <p className="text-sm text-gray-600">{bottleLabel}</p>
        </div>

        {available > 1 ? (
          <QuantityStepper
            value={quantity}
            max={available}
            onChange={setQuantity}
            label="Nombre de bouteilles à déplacer"
          />
        ) : (
          <p className="text-sm text-gray-600">1 bouteille</p>
        )}

        {sameWineQuantity !== null && (
          <p className="text-xs text-sage">
            Ce vin est déjà dans cette clayette (×{sameWineQuantity}) : les bouteilles rejoindront ce lot.
          </p>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="border border-gray-300 rounded px-4 py-2 text-sm"
          >
            Annuler
          </button>
          <button
            ref={confirmRef}
            type="submit"
            disabled={busy || !isValid}
            className="bg-forest text-cream rounded px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy ? 'Déplacement…' : 'Déplacer'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
