'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RegistrationToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationEnabled: !enabled }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de mettre à jour ce réglage.');
      return;
    }
    setEnabled(!enabled);
    router.refresh();
  }

  return (
    <div className="bg-white rounded p-4 max-w-md">
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <div className="flex items-center justify-between text-sm">
        <div>
          <p>Inscriptions ouvertes</p>
          <p className="text-xs text-gray-500">
            Autorise la création d&apos;un compte à l&apos;acceptation d&apos;une invitation.
          </p>
        </div>
        <button onClick={toggle} className="text-xs border border-gray-300 rounded px-3 py-1">
          {enabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>
  );
}
