'use client';

import { useState } from 'react';

export function UserNoteEditor({ bottleId, initialNote }: { bottleId: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(true);

  async function save() {
    await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNote: note }),
    });
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
      {!saved && (
        <button onClick={save} className="mt-2 text-xs bg-forest text-cream rounded px-3 py-1.5">
          Enregistrer
        </button>
      )}
    </div>
  );
}
