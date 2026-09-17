'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crateLabel } from '@/lib/crateLabel';
import { WINE_COLOR_LABELS } from '@/lib/wineColor';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { useToast } from '@/components/Toast';
import { PhotoFillButton, type PhotoExtractionResult } from '@/components/PhotoFillButton';
import { RegionInput } from '@/components/RegionInput';
import { resolveWineGeography } from '@/domain/wineGeography';
import { buildBottleDetails } from '@/lib/bottleDetails';
import type { Crate } from './interfaces/crate.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

export const AddBottleForm = ({
  crates,
  cellarId,
  aiAvailable,
}: {
  crates: Crate[];
  cellarId: string;
  aiAvailable: boolean;
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [crateId, setCrateId] = useState(crates[0]?.id ?? '');
  const [category, setCategory] = useState('wine');
  const [color, setColor] = useState('');
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [region, setRegion] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [grapeVarieties, setGrapeVarieties] = useState('');
  const [appellation, setAppellation] = useState('');
  const [classification, setClassification] = useState('');
  const [vintage, setVintage] = useState('');
  const [abv, setAbv] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const applyExtraction = (data: PhotoExtractionResult): void => {
    if (data.name) {
      setName(data.name);
    }
    if (data.producer) {
      setProducer(data.producer);
    }
    // La géographie extraite passe par le résolveur avant d'atterrir dans
    // le formulaire : une étiquette lue « Saint-Julien » remplit Bordeaux /
    // Haut-Médoc, et tu vois la correction avant d'enregistrer plutôt qu'à
    // la relecture de la fiche.
    if (data.region || data.subRegion || data.appellation) {
      const geography = resolveWineGeography({
        region: data.region,
        subRegion: data.subRegion,
        appellation: data.appellation,
      });
      setRegion(geography.region ?? '');
      setSubRegion(geography.subRegion ?? '');
    }
    if (data.grapeVarieties && data.grapeVarieties.length > 0) {
      setGrapeVarieties(data.grapeVarieties.join(', '));
    }
    if (data.appellation) {
      setAppellation(data.appellation);
    }
    if (data.vintage) {
      setVintage(String(data.vintage));
    }
    if (data.category) {
      setCategory(data.category);
      const hasColor = data.category === 'wine' || data.category === 'sparkling';
      if (hasColor && data.color) {
        setColor(data.color);
      } else if (!hasColor) {
        setColor('');
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/bottles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crateId,
        category,
        name,
        producer: producer || undefined,
        region: region || undefined,
        subRegion: subRegion || undefined,
        color: (category === 'wine' || category === 'sparkling') && color ? color : undefined,
        vintage: vintage ? Number(vintage) : undefined,
        abv: abv.trim() ? Number(abv) : undefined,
        volumeMl: volumeMl.trim() ? Number(volumeMl) : undefined,
        quantity,
        details: buildBottleDetails({ category, grapeVarieties, appellation, classification }),
      }),
    });
    if (!response.ok) {
      const message = await errorMessageFromResponse({
        response,
        fallback: 'Impossible d’ajouter cette bouteille.',
      });
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Bouteille ajoutée.');
    router.push('/cave');
    router.refresh();
  };

  return (
    <div className="max-w-md">
      {aiAvailable && (
        <div className="mb-4">
          <PhotoFillButton
            endpoint="/api/bottles/extract-from-photo"
            extraBody={{ cellarId }}
            onExtracted={applyExtraction}
          />
          <p className="text-xs text-gray-500 mt-1">
            Vérifie et corrige les champs pré-remplis avant d’ajouter — la clayette et la quantité restent à
            choisir toi-même.
          </p>
        </div>
      )}

      <form
        onSubmit={(...args) => void handleSubmit(...args)}
        className="bg-white rounded p-6 max-w-md space-y-4"
      >
        {error && <p className="text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Clayette</label>
          <select
            value={crateId}
            onChange={(e) => setCrateId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            required
          >
            {crates.map((crate) => (
              <option key={crate.id} value={crate.id}>
                {crateLabel({ number: crate.number, name: crate.name })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value !== 'wine' && e.target.value !== 'sparkling') {
                setColor('');
              }
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
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
                <option key={value} value={value}>
                  {label}
                </option>
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

        <RegionInput
          value={region}
          subRegion={subRegion}
          onChange={setRegion}
          onSubRegionChange={setSubRegion}
        />

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

        <div className="flex gap-4">
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
        </div>

        <div className="flex gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide mb-1">Degré (%)</label>
            <input
              value={abv}
              onChange={(e) => setAbv(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
              placeholder="13.5"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide mb-1">Volume (ml)</label>
            <input
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
              placeholder="750"
            />
          </div>
        </div>

        <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Ajouter à la cave
        </button>
      </form>
    </div>
  );
};
