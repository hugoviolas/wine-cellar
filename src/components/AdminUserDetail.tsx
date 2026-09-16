'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserDetail } from './interfaces/user-detail.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';
import { stringFieldFromResponse } from '@/lib/apiJson';

export const AdminUserDetail = ({ user }: { user: UserDetail }): ReactElement => {
  const router = useRouter();
  const [isActive, setIsActive] = useState(user.isActive);
  const [isSuperAdmin, setIsSuperAdmin] = useState(user.isSuperAdmin);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const updateUser = async (patch: { isActive?: boolean; isSuperAdmin?: boolean }): Promise<void> => {
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setError(await errorMessageFromResponse(response, 'Impossible de mettre à jour ce compte.'));
      return;
    }
    if (patch.isActive !== undefined) {
      setIsActive(patch.isActive);
    }
    if (patch.isSuperAdmin !== undefined) {
      setIsSuperAdmin(patch.isSuperAdmin);
    }
    router.refresh();
  };

  const generateResetLink = async (): Promise<void> => {
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}/reset-token`, { method: 'POST' });
    if (!response.ok) {
      setError(await errorMessageFromResponse(response, 'Impossible de générer un lien.'));
      return;
    }
    const token = await stringFieldFromResponse(response, 'token');
    if (token === null) {
      setError('Lien de réinitialisation illisible — réessaie.');
      return;
    }
    setResetLink(`${window.location.origin}/reset-password/${token}`);
  };

  const removeUser = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) {
      setError(await errorMessageFromResponse(response, 'Impossible de supprimer ce compte.'));
      return;
    }
    router.push('/admin/utilisateurs');
    router.refresh();
  };

  return (
    <div className="bg-white rounded p-4 max-w-md space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between text-sm">
        <span>Compte actif</span>
        <button
          onClick={() => void updateUser({ isActive: !isActive })}
          className="text-xs border border-gray-300 rounded px-3 py-1"
        >
          {isActive ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>Super-admin</span>
        <button
          onClick={() => void updateUser({ isSuperAdmin: !isSuperAdmin })}
          className="text-xs border border-gray-300 rounded px-3 py-1"
        >
          {isSuperAdmin ? 'Rétrograder' : 'Promouvoir'}
        </button>
      </div>

      <div>
        <button
          onClick={() => void generateResetLink()}
          className="text-xs bg-forest text-cream rounded px-3 py-2"
        >
          Générer un lien de réinitialisation
        </button>
        {resetLink && (
          <input
            readOnly
            value={resetLink}
            onFocus={(e) => e.target.select()}
            className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-gray-50 mt-2"
          />
        )}
      </div>

      <div>
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Supprimer définitivement ce compte ?</span>
            <button
              type="button"
              onClick={() => void removeUser()}
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
            Supprimer ce compte
          </button>
        )}
      </div>
    </div>
  );
};
