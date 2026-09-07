'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CrateOption {
  id: string;
  number: number;
  name: string;
}

export function BottleActions({
  bottleId,
  otherCrates,
}: {
  bottleId: string;
  otherCrates: CrateOption[];
}) {
  const router = useRouter();
  const [targetCrateId, setTargetCrateId] = useState(otherCrates[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function readError(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function moveBottle() {
    if (!targetCrateId) return;
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crateId: targetCrateId }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(await readError(response, 'Impossible de déplacer cette bouteille.'));
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  async function removeBottle() {
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/bottles/${bottleId}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) {
      setError(await readError(response, 'Impossible de supprimer cette bouteille.'));
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  return (
    <section className="mb-6 space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      {otherCrates.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Déplacer vers</h4>
          <div className="flex gap-2">
            <select
              value={targetCrateId}
              onChange={(e) => setTargetCrateId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
            >
              {otherCrates.map((crate) => (
                <option key={crate.id} value={crate.id}>
                  Clayette {crate.number} — {crate.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={moveBottle}
              disabled={busy}
              className="border border-forest text-forest rounded px-3 py-2 text-sm"
            >
              Déplacer
            </button>
          </div>
        </div>
      )}

      <div>
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Supprimer définitivement cette bouteille ?</span>
            <button
              type="button"
              onClick={removeBottle}
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
}
