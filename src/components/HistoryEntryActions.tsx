'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

interface HistoryEntryValues {
  consumedAt: string;
  quantity: number;
  rating: number | null;
  occasion: string | null;
  comment: string | null;
}

export function HistoryEntryActions({ entryId, initial }: { entryId: string; initial: HistoryEntryValues }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consumedAt, setConsumedAt] = useState(initial.consumedAt.slice(0, 10));
  const [quantity, setQuantity] = useState(initial.quantity);
  const [rating, setRating] = useState(initial.rating?.toString() ?? '');
  const [occasion, setOccasion] = useState(initial.occasion ?? '');
  const [comment, setComment] = useState(initial.comment ?? '');
  const [error, setError] = useState<string | null>(null);

  async function readError(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/history/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumedAt,
        quantity,
        rating: rating === '' ? null : Number(rating),
        occasion: occasion.trim() || null,
        comment: comment.trim() || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const message = await readError(response, 'Impossible d’enregistrer les modifications.');
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Entrée mise à jour.');
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const response = await fetch(`/api/history/${entryId}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) {
      toast.error(await readError(response, 'Impossible de supprimer cette entrée.'));
      return;
    }
    toast.success('Entrée supprimée.');
    router.refresh();
  }

  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-2 mt-2 text-xs">
        <span>Supprimer cette entrée d’historique ?</span>
        <button type="button" onClick={remove} disabled={busy} className="text-red-700 underline">
          Confirmer
        </button>
        <button type="button" onClick={() => setConfirmingDelete(false)} className="text-gray-500 underline">
          Annuler
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 mt-2 text-xs">
        <button type="button" onClick={() => setOpen(true)} className="text-forest underline">
          Modifier
        </button>
        <button type="button" onClick={() => setConfirmingDelete(true)} className="text-red-700 underline">
          Supprimer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2 bg-gray-50 rounded p-3 text-xs">
      {error && <p className="text-red-700">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <div>
          <label className="block uppercase tracking-wide mb-1">Date</label>
          <input
            type="date"
            value={consumedAt}
            onChange={(e) => setConsumedAt(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block uppercase tracking-wide mb-1">Quantité</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 w-20"
          />
        </div>
        <div>
          <label className="block uppercase tracking-wide mb-1">Note</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="">—</option>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block uppercase tracking-wide mb-1">Occasion</label>
        <input
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1"
        />
      </div>
      <div>
        <label className="block uppercase tracking-wide mb-1">Commentaire</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1"
          rows={2}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="bg-forest text-cream rounded px-3 py-1.5">
          Enregistrer
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-500 underline">
          Annuler
        </button>
      </div>
    </form>
  );
}
