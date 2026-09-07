'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Crate {
  id: string;
  number: number;
  name: string;
  capacity: number;
}

export function CrateManager({ cellarId, initialCrates }: { cellarId: string; initialCrates: Crate[] }) {
  const router = useRouter();
  const [crates, setCrates] = useState(initialCrates);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(12);
  const [error, setError] = useState<string | null>(null);

  async function readError(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function addCrate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/crates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellarId, name, capacity }),
    });
    if (!response.ok) {
      setError(await readError(response, 'Impossible d’ajouter cette clayette.'));
      return;
    }
    const created: Crate = await response.json();
    setCrates([...crates, created]);
    setName('');
    router.refresh();
  }

  async function removeCrate(id: string) {
    setError(null);
    const response = await fetch(`/api/crates/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de supprimer cette clayette.'));
      return;
    }
    setCrates(crates.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <form onSubmit={addCrate} className="flex gap-2 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Cidres"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Capacité</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
            min={1}
            required
          />
        </div>
        <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Ajouter
        </button>
      </form>

      <ul className="divide-y divide-gray-200 bg-white rounded">
        {crates.map((crate) => (
          <li key={crate.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>Clayette {crate.number} — {crate.name} ({crate.capacity} emplacements)</span>
            <button onClick={() => removeCrate(crate.id)} className="text-red-700 text-xs">
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
