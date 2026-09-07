'use client';

import Link from 'next/link';

interface BottleRow {
  id: string;
  name: string;
  vintage: number | null;
  quantity: number;
  color: string | null;
}

export function CrateCard({
  number,
  name,
  capacity,
  bottles,
}: {
  number: number;
  name: string;
  capacity: number;
  bottles: BottleRow[];
}) {
  const occupied = bottles.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <h4 className="text-sm italic">Clayette {number} — {name}</h4>
        <span className="text-xs text-gray-500">{occupied}/{capacity}</span>
      </div>
      <div className="bg-white rounded shadow-sm divide-y divide-gray-100">
        {bottles.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">Aucune bouteille</p>}
        {bottles.map((bottle) => (
          <Link
            key={bottle.id}
            href={`/bottles/${bottle.id}`}
            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <span className="flex-1">{bottle.name}</span>
            <span className="text-xs text-gray-500">{bottle.vintage ?? 'NV'}</span>
            <span className="text-xs bg-green-50 text-green-800 rounded-full px-2 py-0.5">×{bottle.quantity}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
