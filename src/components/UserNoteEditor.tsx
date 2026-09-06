'use client';

import { useState } from 'react';

export function UserNoteEditor({ bottleId, initialNote }: { bottleId: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const response = await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNote: note }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(typeof data?.error === 'string' ? data.error : 'Impossible d’enregistrer la note.');
      return;
    }
    setSaved(true);
  }

  return (
    <div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
        rows={3}
        placeholder="Ajouter une note ou corriger l’analyse…"
      />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {!saved && (
        <button onClick={save} className="mt-2 text-xs bg-forest text-cream rounded px-3 py-1.5">
          Enregistrer
        </button>
      )}
    </div>
  );
}
