'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Crate {
  id: string;
  number: number;
  name: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  wine: 'Vin',
  sparkling: 'Champagne / effervescent',
  cider: 'Cidre',
  beer: 'Bière',
  spirit: 'Spiritueux',
};

export function AddBottleForm({ crates }: { crates: Crate[] }) {
  const router = useRouter();
  const [crateId, setCrateId] = useState(crates[0]?.id ?? '');
  const [category, setCategory] = useState('wine');
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
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
        vintage: vintage ? Number(vintage) : undefined,
        quantity,
        details: {},
      }),
    });
    if (!response.ok) {
      setError('Impossible d’ajouter cette bouteille.');
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-6 max-w-md space-y-4">
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
            <option key={crate.id} value={crate.id}>Clayette {crate.number} — {crate.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

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

      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Ajouter à la cave
      </button>
    </form>
  );
}
