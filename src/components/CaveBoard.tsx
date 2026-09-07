'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CrateCard, type BottleRow } from './CrateCard';

interface Crate {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
}

export function CaveBoard({
  crates,
  initialBottlesByCrate,
  canEdit,
}: {
  crates: Crate[];
  initialBottlesByCrate: Record<string, BottleRow[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [bottlesByCrate, setBottlesByCrate] = useState(initialBottlesByCrate);
  const [error, setError] = useState<string | null>(null);
  const [activeBottle, setActiveBottle] = useState<BottleRow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findCrateId(bottleId: string): string | undefined {
    return Object.keys(bottlesByCrate).find((crateId) =>
      bottlesByCrate[crateId].some((b) => b.id === bottleId),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const fromCrateId = findCrateId(String(event.active.id));
    if (!fromCrateId) return;
    setActiveBottle(bottlesByCrate[fromCrateId].find((b) => b.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveBottle(null);
    const { active, over } = event;
    if (!over) return;

    const bottleId = String(active.id);
    const fromCrateId = (active.data.current?.crateId as string | undefined) ?? findCrateId(bottleId);
    if (!fromCrateId) return;
    const toCrateId = (over.data.current?.crateId as string | undefined) ?? String(over.id);

    if (fromCrateId === toCrateId) {
      if (bottleId === String(over.id)) return;
      const items = bottlesByCrate[fromCrateId];
      const oldIndex = items.findIndex((b) => b.id === bottleId);
      const newIndex = items.findIndex((b) => b.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      const previous = bottlesByCrate;
      setError(null);
      setBottlesByCrate({ ...previous, [fromCrateId]: reordered });

      const response = await fetch('/api/bottles/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crateId: fromCrateId, orderedIds: reordered.map((b) => b.id) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(typeof data?.error === 'string' ? data.error : 'Impossible d’enregistrer le nouvel ordre.');
        setBottlesByCrate(previous);
        return;
      }
      router.refresh();
      return;
    }

    const moved = bottlesByCrate[fromCrateId]?.find((b) => b.id === bottleId);
    if (!moved) return;

    const previous = bottlesByCrate;
    setError(null);
    setBottlesByCrate({
      ...previous,
      [fromCrateId]: previous[fromCrateId].filter((b) => b.id !== bottleId),
      [toCrateId]: [...(previous[toCrateId] ?? []), moved],
    });

    const response = await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crateId: toCrateId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(typeof data?.error === 'string' ? data.error : 'Impossible de déplacer cette bouteille.');
      setBottlesByCrate(previous);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <DndContext
        id="cave-board"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid sm:grid-cols-2 gap-6">
          {crates.map((crate) => (
            <CrateCard
              key={crate.id}
              id={crate.id}
              number={crate.number}
              name={crate.name}
              capacity={crate.capacity}
              bottles={bottlesByCrate[crate.id] ?? []}
              canEdit={canEdit}
            />
          ))}
        </div>
        <DragOverlay>
          {activeBottle && (
            <div className="bg-white rounded shadow-md px-3 py-2 text-sm border border-sage">
              {activeBottle.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
