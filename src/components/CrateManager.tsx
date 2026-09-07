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

interface Crate {
  id: string;
  number: number;
  name: string;
  capacity: number;
}

function SortableCrateRow({
  crate,
  onRemove,
  onRename,
}: {
  crate: Crate;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: crate.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [name, setName] = useState(crate.name);

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-2 px-4 py-3 text-sm bg-white">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-gray-400 px-1 select-none"
          aria-label={`Réorganiser Clayette ${crate.number} — ${crate.name}`}
        >
          ⋮⋮
        </button>
        <span className="whitespace-nowrap text-gray-500">Clayette {crate.number} —</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (optionnel)"
          className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-0"
        />
        <span className="whitespace-nowrap text-gray-500">({crate.capacity} emplacements)</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {name !== crate.name && (
          <button
            type="button"
            onClick={() => onRename(crate.id, name)}
            className="text-forest text-xs underline"
          >
            Renommer
          </button>
        )}
        <button onClick={() => onRemove(crate.id)} className="text-red-700 text-xs">
          Supprimer
        </button>
      </div>
    </li>
  );
}

export function CrateManager({ cellarId, initialCrates }: { cellarId: string; initialCrates: Crate[] }) {
  const router = useRouter();
  const [crates, setCrates] = useState(initialCrates);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(12);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  async function renameCrate(id: string, name: string) {
    setError(null);
    const response = await fetch(`/api/crates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de renommer cette clayette.'));
      return;
    }
    // Le serveur applique le même repli sur « Clayette N » pour un nom vide
    // (voir renameCrate côté domaine) — reproduit ici pour que l'état local
    // affiche immédiatement le nom réellement appliqué, sans attendre un
    // aller-retour serveur que router.refresh() seul ne garantit pas de
    // répercuter sur cet état déjà initialisé.
    const trimmed = name.trim();
    setCrates(crates.map((c) => (c.id === id ? { ...c, name: trimmed || `Clayette ${c.number}` } : c)));
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

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
      setError(await readError(response, 'Impossible d’enregistrer le nouvel ordre.'));
      setCrates(previousOrder);
      return;
    }
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

      <DndContext id="crate-manager" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={crates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-gray-200 bg-white rounded">
            {crates.map((crate) => (
              <SortableCrateRow key={crate.id} crate={crate} onRemove={removeCrate} onRename={renameCrate} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
