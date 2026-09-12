'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WINE_COLOR_LABELS } from '@/lib/wineColor';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { useToast } from '@/components/Toast';
import { PhotoFillButton, type PhotoExtractionResult } from '@/components/PhotoFillButton';
import { RegionInput } from '@/components/RegionInput';

export function WishlistAddForm({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState('wine');
  const [color, setColor] = useState('');
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [region, setRegion] = useState('');
  const [grapeVarieties, setGrapeVarieties] = useState('');
  const [appellation, setAppellation] = useState('');
  const [vintage, setVintage] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  function applyExtraction(data: PhotoExtractionResult) {
    if (data.name) setName(data.name);
    if (data.producer) setProducer(data.producer);
    if (data.region) setRegion(data.region);
    if (data.grapeVarieties && data.grapeVarieties.length > 0) setGrapeVarieties(data.grapeVarieties.join(', '));
    if (data.appellation) setAppellation(data.appellation);
    if (data.vintage) setVintage(String(data.vintage));
    if (data.category) {
      setCategory(data.category);
      const hasColor = data.category === 'wine' || data.category === 'sparkling';
      if (hasColor && data.color) {
        setColor(data.color);
      } else if (!hasColor) {
        setColor('');
      }
    }
  }

  function buildDetails(): Record<string, unknown> {
    const grapeVarietiesArray = grapeVarieties
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (category === 'wine') {
      return { grapeVarieties: grapeVarietiesArray, appellation: appellation.trim() || undefined };
    }
    if (category === 'sparkling') {
      return { grapeVarieties: grapeVarietiesArray };
    }
    return {};
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        name,
        producer: producer || undefined,
        region: region || undefined,
        color: (category === 'wine' || category === 'sparkling') && color ? color : undefined,
        vintage: vintage ? Number(vintage) : undefined,
        details: buildDetails(),
        comment: comment.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? 'Impossible d\'ajouter cette bouteille.';
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Ajoutée à la wishlist.');
    router.push('/wishlist');
    router.refresh();
  }

  return (
    <div className="max-w-md">
      {aiAvailable && (
        <div className="mb-4">
          <PhotoFillButton endpoint="/api/wishlist/extract-from-photo" onExtracted={applyExtraction} />
          <p className="text-xs text-gray-500 mt-1">Vérifie et corrige les champs pré-remplis avant d&apos;ajouter.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded p-6 max-w-md space-y-4">
        {error && <p className="text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value !== 'wine' && e.target.value !== 'sparkling') setColor('');
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {(category === 'wine' || category === 'sparkling') && (
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

        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Château Margaux"
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

        <RegionInput value={region} onChange={setRegion} />

        {(category === 'wine' || category === 'sparkling') && (
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

        {category === 'wine' && (
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

        <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Ajouter à la wishlist
        </button>
      </form>
    </div>
  );
}
