'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

export const AdminCellarActions = ({
  cellarId,
  initialAiEnabled,
}: {
  cellarId: string;
  initialAiEnabled: boolean;
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleAi = async (): Promise<void> => {
    const next = !aiEnabled;
    setBusy(true);
    const response = await fetch(`/api/admin/cellars/${cellarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiEnabled: next }),
    });
    setBusy(false);
    if (!response.ok) {
      toast.error(
        await errorMessageFromResponse({ response, fallback: 'Impossible de mettre à jour cette cave.' }),
      );
      return;
    }
    setAiEnabled(next);
    toast.success('Cave mise à jour.');
    router.refresh();
  };

  const remove = async (): Promise<void> => {
    setBusy(true);
    const response = await fetch(`/api/admin/cellars/${cellarId}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) {
      toast.error(
        await errorMessageFromResponse({ response, fallback: 'Impossible de supprimer cette cave.' }),
      );
      return;
    }
    toast.success('Cave supprimée.');
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <label className="flex items-center gap-1 text-gray-500">
        <input type="checkbox" checked={aiEnabled} disabled={busy} onChange={() => void toggleAi()} />
        IA
      </label>
      {confirmingDelete ? (
        <>
          <span>Supprimer définitivement cette cave et tout son contenu ?</span>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="text-red-700 underline"
          >
            Confirmer
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="text-gray-500 underline"
          >
            Annuler
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          className="text-red-700 underline"
        >
          Supprimer
        </button>
      )}
    </div>
  );
};
