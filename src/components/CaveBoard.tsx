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
import { MoveBottlesDialog } from './MoveBottlesDialog';
import { useToast } from '@/components/Toast';
import type { Crate } from './interfaces/crate.interface';
import type { PendingBottleMove } from './interfaces/pending-bottle-move.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import { applyBottleMove, bottleMoveMessage, requestBottleMove } from '@/lib/bottleMove';
import { crateLabel } from '@/lib/crateLabel';
import { isSameWine } from '@/domain/bottleIdentity';
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
  // Après un `router.refresh()`, la page serveur renvoie l'état réel de la
  // cave : on le reprend tel quel, plutôt que de garder une copie locale
  // qui divergerait (ex. un lot fusionné ou supprimé par le serveur).
  const [syncedBottlesByCrate, setSyncedBottlesByCrate] = useState(initialBottlesByCrate);
  if (syncedBottlesByCrate !== initialBottlesByCrate) {
    setSyncedBottlesByCrate(initialBottlesByCrate);
    setBottlesByCrate(initialBottlesByCrate);
  }
  const [error, setError] = useState<string | null>(null);
  const [activeBottle, setActiveBottle] = useState<BottleRow | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingBottleMove | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

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
        const message = await errorMessageFromResponse({
          response,
          fallback: 'Impossible d’enregistrer le nouvel ordre.',
        });
        setError(message);
        toast.error(message);
        setBottlesByCrate(previous);
        return;
      }
      router.refresh();
      return;
    }

    const moved = bottlesByCrate[fromCrateId]?.find((b) => b.id === bottleId);
    if (!moved || !crates.some((crate) => crate.id === toCrateId)) {
      return;
    }
    // Rien ne bouge avant confirmation : un lâcher accidentel s'annule d'un
    // clic, et c'est là qu'on choisit combien de bouteilles déplacer.
    setError(null);
    setMoveError(null);
    setPendingMove({ bottle: moved, fromCrateId, toCrateId });
  };

  const labelOfCrate = (crateId: string): string => {
    const crate = crates.find((c) => c.id === crateId);
    return crate ? crateLabel({ number: crate.number, name: crate.name }) : 'la clayette';
  };

  const confirmMove = async (quantity: number): Promise<void> => {
    if (!pendingMove) {
      return;
    }
    const { bottle, fromCrateId, toCrateId } = pendingMove;
    setMoving(true);
    setMoveError(null);
    const outcome = await requestBottleMove({
      bottleId: bottle.id,
      crateId: toCrateId,
      quantity: quantity < bottle.quantity ? quantity : undefined,
    });
    setMoving(false);
    if (!outcome.ok) {
      setMoveError(outcome.message);
      return;
    }
    const { result } = outcome;
    if (result) {
      setBottlesByCrate((current) =>
        applyBottleMove({ bottlesByCrate: current, bottle, fromCrateId, toCrateId, quantity, result }),
      );
    }
    setPendingMove(null);
    toast.success(
      bottleMoveMessage({ quantity, merged: result?.merged ?? false, targetLabel: labelOfCrate(toCrateId) }),
    );
    router.refresh();
  };

  const sameWineQuantity = (move: PendingBottleMove): number | null => {
    const lot = (bottlesByCrate[move.toCrateId] ?? []).find(
      (b) => b.id !== move.bottle.id && isSameWine(b, move.bottle),
    );
    return lot ? lot.quantity : null;
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
      {pendingMove && (
        <MoveBottlesDialog
          key={`${pendingMove.bottle.id}-${pendingMove.toCrateId}`}
          bottleLabel={[pendingMove.bottle.name, pendingMove.bottle.vintage].filter(Boolean).join(' ')}
          available={pendingMove.bottle.quantity}
          targetLabel={labelOfCrate(pendingMove.toCrateId)}
          sameWineQuantity={sameWineQuantity(pendingMove)}
          busy={moving}
          error={moveError}
          onConfirm={(quantity) => void confirmMove(quantity)}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </div>
  );
};
