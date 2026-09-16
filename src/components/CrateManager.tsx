'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { crateLabel } from '@/lib/crateLabel';
import { useToast } from '@/components/Toast';
import type { Crate } from './interfaces/crate.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';
import { z } from 'zod';
import { readJsonBody } from '@/lib/readJsonBody';

const SortableCrateRow = ({
  crate,
  onRemove,
  onSave,
}: {
  crate: Crate;
  onRemove: (id: string) => void;
  onSave: (id: string, name: string, capacity: number) => void;
}): ReactElement => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: crate.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [name, setName] = useState(crate.name ?? '');
  const [capacity, setCapacity] = useState(crate.capacity);
  const changed = name !== (crate.name ?? '') || capacity !== crate.capacity;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-sm bg-white"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-gray-400 px-1 select-none"
          aria-label={`Réorganiser ${crateLabel(crate.number, crate.name)}`}
        >
          ⋮⋮
        </button>
        <span className="whitespace-nowrap text-gray-500 shrink-0">Clayette {crate.number} —</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (optionnel)"
          className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-0"
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap sm:shrink-0 pl-8 sm:pl-0">
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
        />
        <span className="whitespace-nowrap text-gray-500">emplacements</span>
        {changed && capacity >= 1 && (
          <button
            type="button"
            onClick={() => onSave(crate.id, name, capacity)}
            className="text-forest text-xs underline"
          >
            Enregistrer
          </button>
        )}
        <button onClick={() => onRemove(crate.id)} className="text-red-700 text-xs">
          Supprimer
        </button>
      </div>
    </li>
  );
};

/**
 * La clayette renvoyée par l'API est relue ici plutôt qu'acceptée sur
 * parole : `json()` ne garantit rien, et une forme inattendue se
 * propagerait jusqu'à l'affichage.
 */
const crateSchema = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string().nullable(),
  capacity: z.number(),
});

export const CrateManager = ({
  cellarId,
  initialCrates,
}: {
  cellarId: string;
  initialCrates: Crate[];
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [crates, setCrates] = useState(initialCrates);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(12);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addCrate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/crates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellarId, name, capacity }),
    });
    if (!response.ok) {
      const message = await errorMessageFromResponse(response, 'Impossible d’ajouter cette clayette.');
      setError(message);
      toast.error(message);
      return;
    }
    const created = crateSchema.safeParse(await readJsonBody(response));
    if (!created.success) {
      setError('Clayette créée, mais la réponse est illisible — recharge la page.');
      return;
    }
    setCrates([...crates, created.data]);
    setName('');
    toast.success('Clayette ajoutée.');
    router.refresh();
  };

  const saveCrate = async (id: string, name: string, capacity: number): Promise<void> => {
    setError(null);
    const response = await fetch(`/api/crates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, capacity }),
    });
    if (!response.ok) {
      const message = await errorMessageFromResponse(response, 'Impossible de mettre à jour cette clayette.');
      setError(message);
      toast.error(message);
      return;
    }
    // Le serveur stocke `null` pour un nom vide (voir renameCrate côté
    // domaine) — reproduit ici pour que l'état local reflète immédiatement
    // la valeur réellement stockée, sans attendre un aller-retour serveur
    // que router.refresh() seul ne garantit pas de répercuter sur cet état
    // déjà initialisé. `crateLabel` calcule « Clayette N » à l'affichage
    // à partir de ce `null` — ne jamais stocker ce texte ici.
    const trimmed = name.trim();
    setCrates(crates.map((c) => (c.id === id ? { ...c, name: trimmed || null, capacity } : c)));
    toast.success('Clayette mise à jour.');
    router.refresh();
  };

  const removeCrate = async (id: string): Promise<void> => {
    setError(null);
    const response = await fetch(`/api/crates/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const message = await errorMessageFromResponse(response, 'Impossible de supprimer cette clayette.');
      setError(message);
      toast.error(message);
      return;
    }
    setCrates(crates.filter((c) => c.id !== id));
    toast.success('Clayette supprimée.');
    router.refresh();
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const previousOrder = crates;
    const oldIndex = crates.findIndex((c) => c.id === active.id);
    const newIndex = crates.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(crates, oldIndex, newIndex);
    setCrates(reordered);

    const response = await fetch('/api/crates/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellarId, orderedIds: reordered.map((c) => c.id) }),
    });
    if (!response.ok) {
      setError(await errorMessageFromResponse(response, 'Impossible d’enregistrer le nouvel ordre.'));
      setCrates(previousOrder);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <form onSubmit={(...args) => void addCrate(...args)} className="flex gap-2 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Cidres (optionnel)"
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

      <DndContext
        id="crate-manager"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(...args) => void handleDragEnd(...args)}
      >
        <SortableContext items={crates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-gray-200 bg-white rounded">
            {crates.map((crate) => (
              <SortableCrateRow
                key={crate.id}
                crate={crate}
                onRemove={(id) => void removeCrate(id)}
                onSave={(id, name, capacity) => void saveCrate(id, name, capacity)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
};
