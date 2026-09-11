'use client';

import Link from 'next/link';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { wineColorDotClass } from '@/lib/wineColor';
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

function SortableBottleChip({ bottle, crateId, canEdit }: { bottle: BottleRow; crateId: string; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bottle.id,
    data: { crateId },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1.5 text-xs"
    >
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-gray-300 select-none -ml-1"
          aria-label={`Déplacer ${bottle.name}`}
        >
          ⋮⋮
        </button>
      )}
      <span className={`w-[3px] h-3.5 rounded-sm shrink-0 ${wineColorDotClass(bottle.color)}`} />
      <Link href={`/bottles/${bottle.id}`} className="flex items-center gap-1.5 hover:underline">
        <span>{bottle.name}</span>
        {bottle.category !== 'wine' && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            {CATEGORY_SHORT_LABELS[bottle.category] ?? bottle.category}
          </span>
        )}
        {bottle.vintage && <span className="text-gray-400">{bottle.vintage}</span>}
        <span className="text-gray-400">×{bottle.quantity}</span>
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
  const fillPercent = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="border-b border-gray-200 py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h4 className="text-base italic">{crateLabel(number, name)}</h4>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gold" style={{ width: `${fillPercent}%` }} />
          </div>
          <span className="text-xs text-gray-500 tabular-nums">{occupied}/{capacity}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-wrap gap-2 min-h-10 rounded ${isOver ? 'ring-2 ring-sage' : ''}`}
      >
        {bottles.length === 0 && <p className="text-xs text-gray-400 italic py-1.5">Aucune bouteille</p>}
        <SortableContext items={bottles.map((b) => b.id)} strategy={rectSortingStrategy}>
          {bottles.map((bottle) => (
            <SortableBottleChip key={bottle.id} bottle={bottle} crateId={id} canEdit={canEdit} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
