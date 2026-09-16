'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CrateCard, type BottleRow } from './CrateCard';
import { useToast } from '@/components/Toast';
import type { Crate } from './interfaces/crate.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

/**
 * dnd-kit transporte des données libres dans `data.current` : on vérifie ce
 * qu'on y lit plutôt que de le transtyper, la valeur venant d'ailleurs que
 * de ce composant.
 */
const crateIdFromDragData = (data: Record<string, unknown> | undefined): string | undefined => {
  const crateId = data?.crateId;
  return typeof crateId === 'string' ? crateId : undefined;
};

export const CaveBoard = ({
  crates,
  initialBottlesByCrate,
  canEdit,
}: {
  crates: Crate[];
  initialBottlesByCrate: Record<string, BottleRow[]>;
  canEdit: boolean;
}): ReactElement => {
  const router = useRouter();
  const toast = useToast();
  const [bottlesByCrate, setBottlesByCrate] = useState(initialBottlesByCrate);
  const [error, setError] = useState<string | null>(null);
  const [activeBottle, setActiveBottle] = useState<BottleRow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // closestCenter compare les centres des rectangles, pas la position du
  // pointeur — avec des clayettes de hauteurs très différentes (une vide ne
  // fait que quelques px, une pleine peut être bien plus haute), ça pouvait
  // résoudre la mauvaise clayette cible. pointerWithin (position réelle du
  // pointeur) est plus fiable ici ; rectIntersection en repli pour les cas
  // où le pointeur sort de tout rectangle (ex. relâché juste en dehors).
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  };

  const findCrateId = (bottleId: string): string | undefined => {
    return Object.keys(bottlesByCrate).find((crateId) =>
      (bottlesByCrate[crateId] ?? []).some((b) => b.id === bottleId),
    );
  };

  const handleDragStart = (event: DragStartEvent): void => {
    const fromCrateId = findCrateId(String(event.active.id));
    if (!fromCrateId) {
      return;
    }
    const bottles = bottlesByCrate[fromCrateId] ?? [];
    setActiveBottle(bottles.find((b) => b.id === event.active.id) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveBottle(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const bottleId = String(active.id);
    const fromCrateId = crateIdFromDragData(active.data.current) ?? findCrateId(bottleId);
    if (!fromCrateId) {
      return;
    }
    const toCrateId = crateIdFromDragData(over.data.current) ?? String(over.id);

    if (fromCrateId === toCrateId) {
      if (bottleId === String(over.id)) {
        return;
      }
      const items = bottlesByCrate[fromCrateId] ?? [];
      const oldIndex = items.findIndex((b) => b.id === bottleId);
      const newIndex = items.findIndex((b) => b.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }

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
        const message = await errorMessageFromResponse(response, 'Impossible d’enregistrer le nouvel ordre.');
        setError(message);
        toast.error(message);
        setBottlesByCrate(previous);
        return;
      }
      router.refresh();
      return;
    }

    const moved = bottlesByCrate[fromCrateId]?.find((b) => b.id === bottleId);
    if (!moved) {
      return;
    }

    const previous = bottlesByCrate;
    setError(null);
    setBottlesByCrate({
      ...previous,
      [fromCrateId]: (previous[fromCrateId] ?? []).filter((b) => b.id !== bottleId),
      [toCrateId]: [...(previous[toCrateId] ?? []), moved],
    });

    const response = await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crateId: toCrateId }),
    });
    if (!response.ok) {
      const message = await errorMessageFromResponse(response, 'Impossible de déplacer cette bouteille.');
      setError(message);
      toast.error(message);
      setBottlesByCrate(previous);
      return;
    }
    router.refresh();
  };

  return (
    <div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <DndContext
        id="cave-board"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={(...args) => void handleDragEnd(...args)}
      >
        <div className="bg-white rounded shadow-sm px-4">
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
};
