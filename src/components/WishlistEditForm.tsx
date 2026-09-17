'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WINE_COLOR_LABELS } from '@/lib/wineColor';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { useToast } from '@/components/Toast';
import { RegionInput } from '@/components/RegionInput';
import { buildBottleDetails } from '@/lib/bottleDetails';
import type { WishlistItemFields } from './interfaces/wishlist-item-fields.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

export const WishlistEditForm = ({ item }: { item: WishlistItemFields }): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [producer, setProducer] = useState(item.producer ?? '');
  const [vintage, setVintage] = useState(item.vintage?.toString() ?? '');
  const [region, setRegion] = useState(item.region ?? '');
  const [subRegion, setSubRegion] = useState(item.subRegion ?? '');
  const [color, setColor] = useState(item.color ?? '');
  const [grapeVarieties, setGrapeVarieties] = useState(item.grapeVarieties.join(', '));
  const [appellation, setAppellation] = useState(item.appellation ?? '');
  const [classification, setClassification] = useState(item.classification ?? '');
  const [comment, setComment] = useState(item.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/wishlist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        producer: producer.trim() || null,
        vintage: vintage.trim() ? Number(vintage) : null,
        region: region.trim() || null,
        subRegion: subRegion.trim() || null,
        color: color || null,
        details: buildBottleDetails({
          category: item.category,
          grapeVarieties,
          appellation,
          classification,
        }),
        comment: comment.trim() || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const message = await errorMessageFromResponse({
        response,
        fallback: "Impossible d'enregistrer les modifications.",
      });
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Modifications enregistrées.');
    router.refresh();
  };

  const handleDelete = async (): Promise<void> => {
    setBusy(true);
    const response = await fetch(`/api/wishlist/${item.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) {
      toast.error('Impossible de supprimer cet item.');
      return;
    }
    toast.success('Supprimée de la wishlist.');
    router.push('/wishlist');
    router.refresh();
  };

  return (
    <form onSubmit={(...args) => void handleSubmit(...args)} className="bg-white rounded p-4 space-y-3">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
        <p className="text-sm text-gray-500">{CATEGORY_LABELS[item.category] ?? item.category}</p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Producteur</label>
        <input
          value={producer}
          onChange={(e) => setProducer(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>

      {(item.category === 'wine' || item.category === 'sparkling') && (
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Couleur</label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {Object.entries(WINE_COLOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      <RegionInput
        value={region}
        subRegion={subRegion}
        onChange={setRegion}
        onSubRegionChange={setSubRegion}
      />

      {(item.category === 'wine' || item.category === 'sparkling') && (
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Cépages</label>
          <input
            value={grapeVarieties}
            onChange={(e) => setGrapeVarieties(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Niellucciu, Syrah"
          />
        </div>
      )}

      {item.category === 'wine' && (
        <>
          <div>
            <label className="block text-xs uppercase tracking-wide mb-1">Appellation</label>
            <input
              value={appellation}
              onChange={(e) => setAppellation(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Patrimonio"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide mb-1">Classement</label>
            <input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Grand Cru Classé"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Millésime</label>
        <input
          value={vintage}
          onChange={(e) => setVintage(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-28"
          placeholder="2015"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Commentaire</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={3}
          placeholder="Conseillée par Paul, vue à 25 € chez le caviste…"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="bg-forest text-cream rounded px-4 py-2 text-sm"
        >
          Enregistrer les modifications
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="text-xs text-red-700 underline"
        >
          Supprimer
        </button>
      </div>
    </form>
  );
};
