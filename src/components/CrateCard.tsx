'use client';

import Link from 'next/link';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { wineColorStripeClass } from '@/lib/wineColor';
import { crateLabel } from '@/lib/crateLabel';
import { CATEGORY_SHORT_LABELS } from '@/lib/bottleCategory';

export interface BottleRow {
  id: string;
  name: string;
  category: string;
  vintage: number | null;
  quantity: number;
  color: string | null;
}

function SortableBottleRow({ bottle, crateId, canEdit }: { bottle: BottleRow; crateId: string; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bottle.id,
    data: { crateId },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex items-center hover:bg-gray-50 ${wineColorStripeClass(bottle.color)}`}
    >
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-gray-400 pl-2 pr-1 select-none"
          aria-label={`Déplacer ${bottle.name}`}
        >
          ⋮⋮
        </button>
      )}
      <Link
        href={`/bottles/${bottle.id}`}
        className={`flex-1 flex items-center gap-3 py-2 text-sm ${canEdit ? 'pr-3' : 'px-3'}`}
      >
        <span className="flex-1">{bottle.name}</span>
        {bottle.category !== 'wine' && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            {CATEGORY_SHORT_LABELS[bottle.category] ?? bottle.category}
          </span>
        )}
        <span className="text-xs text-gray-500">{bottle.vintage ?? 'NV'}</span>
        <span className="text-xs bg-green-50 text-green-800 rounded-full px-2 py-0.5">×{bottle.quantity}</span>
      </Link>
    </div>
  );
}

export function CrateCard({
  id,
  number,
  name,
  capacity,
  bottles,
  canEdit,
}: {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  bottles: BottleRow[];
  canEdit: boolean;
}) {
  const occupied = bottles.reduce((sum, b) => sum + b.quantity, 0);
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <h4 className="text-sm italic">{crateLabel(number, name)}</h4>
        <span className="text-xs text-gray-500">{occupied}/{capacity}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`bg-white rounded shadow-sm divide-y divide-gray-100 ${isOver ? 'ring-2 ring-sage' : ''}`}
      >
        {bottles.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">Aucune bouteille</p>}
        <SortableContext items={bottles.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {bottles.map((bottle) => (
            <SortableBottleRow key={bottle.id} bottle={bottle} crateId={id} canEdit={canEdit} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
