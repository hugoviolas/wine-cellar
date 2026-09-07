'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

export function UserNoteEditor({
  bottleId,
  initialNote,
  initialRating,
}: {
  bottleId: string;
  initialNote: string | null;
  initialRating: number | null;
}) {
  const toast = useToast();
  const [note, setNote] = useState(initialNote ?? '');
  const [rating, setRating] = useState(initialRating?.toString() ?? '');
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const response = await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNote: note, rating: rating === '' ? null : Number(rating) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = typeof data?.error === 'string' ? data.error : 'Impossible d’enregistrer la note.';
      setError(message);
      toast.error(message);
      return;
    }
    setSaved(true);
    toast.success('Note enregistrée.');
  }

  return (
    <div>
      <label className="block text-xs uppercase tracking-wide mb-1">Note (0 à 5)</label>
      <select
        value={rating}
        onChange={(e) => { setRating(e.target.value); setSaved(false); }}
        className="border border-gray-300 rounded px-3 py-2 text-sm mb-3"
      >
        <option value="">—</option>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
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
