'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WINE_COLOR_LABELS } from '@/lib/wineColor';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { useToast } from '@/components/Toast';
import { RegionInput } from '@/components/RegionInput';

interface WishlistItemFields {
  id: string;
  category: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  color: string | null;
  grapeVarieties: string[];
  appellation: string | null;
}

export function WishlistEditForm({ item }: { item: WishlistItemFields }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [producer, setProducer] = useState(item.producer ?? '');
  const [vintage, setVintage] = useState(item.vintage?.toString() ?? '');
  const [region, setRegion] = useState(item.region ?? '');
  const [color, setColor] = useState(item.color ?? '');
  const [grapeVarieties, setGrapeVarieties] = useState(item.grapeVarieties.join(', '));
  const [appellation, setAppellation] = useState(item.appellation ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function buildDetails(): Record<string, unknown> | undefined {
    const grapeVarietiesArray = grapeVarieties
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (item.category === 'wine') {
      return { grapeVarieties: grapeVarietiesArray, appellation: appellation.trim() || undefined };
    }
    if (item.category === 'sparkling') {
      return { grapeVarieties: grapeVarietiesArray };
    }
    return undefined;
  }

  async function handleSubmit(event: React.FormEvent) {
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
        color: color || null,
        details: buildDetails(),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? "Impossible d'enregistrer les modifications.";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Modifications enregistrées.");
    router.refresh();
  }

  async function handleDelete() {
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
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-4 space-y-3">
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
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      <RegionInput value={region} onChange={setRegion} />

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
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Appellation</label>
          <input
            value={appellation}
            onChange={(e) => setAppellation(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Patrimonio"
          />
        </div>
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

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !name.trim()} className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Enregistrer les modifications
        </button>
        <button type="button" onClick={handleDelete} disabled={busy} className="text-xs text-red-700 underline">
          Supprimer
        </button>
      </div>
    </form>
  );
}
