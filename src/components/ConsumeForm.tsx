'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

export function ConsumeForm({ bottleId, maxQuantity }: { bottleId: string; maxQuantity: number }) {
  const router = useRouter();
  const toast = useToast();
  const [consumedAt, setConsumedAt] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('');
  const [occasion, setOccasion] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/bottles/${bottleId}/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumedAt, quantity, rating, comment, occasion }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? 'Impossible d’enregistrer la consommation.';
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Consommation enregistrée.');
    router.push('/cave');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-6 max-w-md space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Date</label>
        <input
          type="date"
          value={consumedAt}
          onChange={(e) => setConsumedAt(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">
          Quantité (max {maxQuantity})
        </label>
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-20"
          required
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Note (0 à 5)</label>
        <input
          type="number"
          min={0}
          max={5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-20"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Occasion</label>
        <input
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="Dîner entre amis"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Commentaire</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <button
        type="submit"
        disabled={quantity < 1 || quantity > maxQuantity}
        className="bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Confirmer la consommation
      </button>
    </form>
  );
}
