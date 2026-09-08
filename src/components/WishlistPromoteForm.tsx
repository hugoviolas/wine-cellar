'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { crateLabel } from '@/lib/crateLabel';
import type { PromotionTarget } from '@/domain/wishlist';

export function WishlistPromoteForm({ itemId, targets }: { itemId: string; targets: PromotionTarget[] }) {
  const router = useRouter();
  const toast = useToast();
  const firstCrate = targets[0]?.crates[0];
  const [crateId, setCrateId] = useState(firstCrate?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/wishlist/${itemId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crateId, quantity }),
    });
    if (!response.ok) {
      setBusy(false);
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Impossible d'ajouter cette bouteille à la cave.");
      return;
    }
    const data = await response.json();
    toast.success('Bouteille ajoutée à la cave.');
    router.push(`/bottles/${data.bottleId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-4 space-y-3">
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Clayette</label>
        <select
          value={crateId}
          onChange={(e) => setCrateId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          required
        >
          {targets.map((target) => (
            <optgroup key={target.cellarId} label={target.cellarName}>
              {target.crates.map((crate) => (
                <option key={crate.id} value={crate.id}>{crateLabel(crate.number, crate.name)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Quantité</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
          min={1}
          required
        />
      </div>
      <button type="submit" disabled={busy || !crateId} className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Ajouter à ma cave
      </button>
    </form>
  );
}
