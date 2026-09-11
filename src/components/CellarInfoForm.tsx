'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

export function CellarInfoForm({
  cellarId,
  initialName,
  initialBrand,
  initialModel,
  initialNotes,
}: {
  cellarId: string;
  initialName: string;
  initialBrand: string | null;
  initialModel: string | null;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState(initialBrand ?? '');
  const [model, setModel] = useState(initialModel ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Le nom de la cave ne peut pas être vide.');
      return;
    }
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/cellars/${cellarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brand, model, notes }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? 'Impossible d’enregistrer les infos de la cave.';
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Infos de la cave mises à jour.');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-4 mb-6 space-y-3">
      <h3 className="text-sm">Infos de la cave</h3>
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="Ma Cave"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wide mb-1">Marque</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="EuroCave"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wide mb-1">Modèle</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Premiere S"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={3}
          placeholder="Cave à double zone, achetée en 2024…"
        />
      </div>

      <button type="submit" disabled={busy} className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Enregistrer
      </button>
    </form>
  );
}
