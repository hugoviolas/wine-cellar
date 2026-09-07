'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { WINE_COLOR_LABELS } from '@/lib/wineColor';
import { GARDE_STATUS_LABELS, type GardeStatus } from '@/domain/gardeStatus';

export interface WineListRow {
  id: string;
  name: string;
  producer: string | null;
  category: string;
  color: string | null;
  vintage: number | null;
  quantity: number;
  rating: number | null;
  gardeStatus: GardeStatus;
  createdAt: string;
}

const ALL = '__all__';

export function WineListView({ rows }: { rows: WineListRow[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [color, setColor] = useState(ALL);
  const [vintage, setVintage] = useState(ALL);
  const [gardeStatus, setGardeStatus] = useState(ALL);

  const vintageOptions = useMemo(() => {
    const years = new Set(rows.map((r) => r.vintage).filter((v): v is number => v != null));
    return Array.from(years).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !`${row.name} ${row.producer ?? ''}`.toLowerCase().includes(query)) return false;
      if (category !== ALL && row.category !== category) return false;
      if (color !== ALL && row.color !== color) return false;
      if (vintage !== ALL && String(row.vintage) !== vintage) return false;
      if (gardeStatus !== ALL && row.gardeStatus !== gardeStatus) return false;
      return true;
    });
  }, [rows, search, category, color, vintage, gardeStatus]);

  return (
    <div>
      <div className="bg-white rounded p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Recherche</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou producteur…"
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={ALL}>Toutes</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Couleur</label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={ALL}>Toutes</option>
            {Object.entries(WINE_COLOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Millésime</label>
          <select
            value={vintage}
            onChange={(e) => setVintage(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={ALL}>Tous</option>
            {vintageOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Garde</label>
          <select
            value={gardeStatus}
            onChange={(e) => setGardeStatus(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={ALL}>Toutes</option>
            {Object.entries(GARDE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {filtered.length} bouteille{filtered.length > 1 ? 's' : ''} référencée{filtered.length > 1 ? 's' : ''}
      </p>

      <div className="bg-white rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">Couleur</th>
              <th className="px-3 py-2">Millésime</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Quantité</th>
              <th className="px-3 py-2">Garde</th>
              <th className="px-3 py-2">Ajoutée le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/bottles/${row.id}`} className="text-forest underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{CATEGORY_LABELS[row.category] ?? row.category}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.color ? WINE_COLOR_LABELS[row.color] ?? row.color : '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.vintage ?? 'NV'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.rating != null ? `${row.rating}/5` : '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">×{row.quantity}</td>
                <td className="px-3 py-2 whitespace-nowrap">{GARDE_STATUS_LABELS[row.gardeStatus]}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Aucune bouteille ne correspond à ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
