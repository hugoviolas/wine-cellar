'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FRANCE_PATHS, FRANCE_VIEWBOX, projectLatLon } from '@/lib/franceMap';
import { buildMapPlaces, type BottleForMap, type MapPlace, type MapPrecision } from '@/domain/wineMap';
import { wineColorDotClass } from '@/lib/wineColor';
import { factLine } from '@/lib/stringArray';
import type { ReactElement } from 'react';

/** Couleur de remplissage d'un point, dans les teintes déjà utilisées par les pastilles de la cave. */
const PIN_FILL: Record<string, string> = {
  rouge: '#7a2331',
  blanc: '#c9a646',
  rose: '#e0a3ad',
  autre: '#8a8577',
};

/**
 * Couleur dominante d'un lieu, à la quantité et non au nombre de
 * références : trois cartons de blanc pèsent plus qu'une unique bouteille
 * de rouge, et c'est bien ce que le point doit dire.
 */
const dominantColor = (wines: readonly BottleForMap[]): string => {
  const totals = new Map<string, number>();
  for (const wine of wines) {
    const key = wine.color ?? 'autre';
    totals.set(key, (totals.get(key) ?? 0) + wine.quantity);
  }
  let best = 'autre';
  let bestTotal = -1;
  for (const [color, total] of totals) {
    if (total > bestTotal) {
      best = color;
      bestTotal = total;
    }
  }
  return best;
};

/**
 * Rayon du point : proportionnel à la racine du nombre de bouteilles, donc
 * à la surface du disque. Le linéaire ferait grossir douze bouteilles
 * jusqu'à couvrir une région entière.
 */
const pinRadius = ({ bottles, precision }: { bottles: number; precision: MapPrecision }): number => {
  const base = precision === 'subRegion' ? 11 : 19;
  const growth = precision === 'subRegion' ? 3.6 : 5.2;
  return base + growth * Math.sqrt(bottles);
};

const LABEL_FONT_SIZE = 25;
/** Demi-largeur approchée d'un nom, à la louche : les glyphes d'Helvetica font ~0,53 em. */
const labelHalfWidth = (label: string): number => (label.length * LABEL_FONT_SIZE * 0.53) / 2;
const labelTop = ({ y, radius }: { y: number; radius: number }): number => y + radius + 10;

interface Box {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const overlaps = (a: Box, b: Box): boolean => {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
};

/**
 * Noms affichables sans chevauchement.
 *
 * Deux sous-régions voisines (Graves et Sauternais, Côte de Nuits et Côte
 * de Beaune) sont à vingt kilomètres : leurs noms se superposaient en
 * bouillie illisible. On parcourt les lieux du plus fourni au moins fourni
 * — l'ordre que `buildMapPlaces` garantit — et on abandonne le nom qui
 * heurterait un point ou un nom déjà posé. Le point, lui, reste : c'est le
 * nom qui est de trop, pas le lieu, et le panneau latéral les nomme tous.
 */
const visibleLabelKeys = ({
  places,
  precision,
}: {
  places: readonly MapPlace[];
  precision: MapPrecision;
}): ReadonlySet<string> => {
  const taken: Box[] = places.map((place) => {
    const { x, y } = projectLatLon(place.coords);
    const radius = pinRadius({ bottles: place.bottles, precision });
    return { x1: x - radius, y1: y - radius, x2: x + radius, y2: y + radius };
  });

  const visible = new Set<string>();
  for (const place of places) {
    const { x, y } = projectLatLon(place.coords);
    const radius = pinRadius({ bottles: place.bottles, precision });
    const halfWidth = labelHalfWidth(place.label);
    const top = labelTop({ y, radius });
    const box: Box = { x1: x - halfWidth, y1: top, x2: x + halfWidth, y2: top + LABEL_FONT_SIZE };
    if (taken.some((other) => overlaps(box, other))) {
      continue;
    }
    taken.push(box);
    visible.add(place.key);
  }
  return visible;
};

const precisionButtonClass = (active: boolean): string => {
  return `px-3 py-1.5 text-xs ${active ? 'bg-forest text-cream' : 'text-forest'}`;
};

export const CaveMap = ({ bottles }: { bottles: readonly BottleForMap[] }): ReactElement => {
  const [precision, setPrecision] = useState<MapPrecision>('region');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { places, unlocated } = useMemo(() => {
    return buildMapPlaces({ bottles, precision });
  }, [bottles, precision]);

  const labelledKeys = useMemo(() => visibleLabelKeys({ places, precision }), [places, precision]);

  const selected = places.find((place) => place.key === selectedKey) ?? null;
  const maxBottles = places[0]?.bottles ?? 1;

  const changePrecision = (next: MapPrecision): void => {
    setPrecision(next);
    // Le lieu sélectionné n'existe plus forcément à l'autre niveau : un
    // « Haut-Médoc » n'a pas d'équivalent en vue régionale.
    setSelectedKey(null);
  };

  const select = (key: string): void => {
    setSelectedKey((current) => (current === key ? null : key));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start">
      <div className="bg-white rounded">
        <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs uppercase tracking-wide text-gray-500">France viticole</span>
          <div className="inline-flex rounded-full border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => changePrecision('region')}
              aria-pressed={precision === 'region'}
              className={precisionButtonClass(precision === 'region')}
            >
              Par région
            </button>
            <button
              type="button"
              onClick={() => changePrecision('subRegion')}
              aria-pressed={precision === 'subRegion'}
              className={precisionButtonClass(precision === 'subRegion')}
            >
              Au plus précis
            </button>
          </div>
        </div>

        <div className="px-2 pt-2 pb-3">
          <svg
            viewBox={FRANCE_VIEWBOX}
            className="w-full h-auto block"
            role="img"
            aria-label={`Carte de France des vins en cave — ${places.length} lieu${places.length > 1 ? 'x' : ''}`}
          >
            <g aria-hidden="true">
              {FRANCE_PATHS.map((path, index) => (
                <path
                  key={index}
                  d={path}
                  fill="#e6e1d3"
                  stroke="#cfc8b4"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
              ))}
            </g>

            {places.map((place) => {
              const { x, y } = projectLatLon(place.coords);
              const radius = pinRadius({ bottles: place.bottles, precision });
              const isSelected = place.key === selectedKey;
              return (
                <g
                  key={place.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${place.label} : ${place.bottles} bouteille${place.bottles > 1 ? 's' : ''}`}
                  aria-pressed={isSelected}
                  className="cursor-pointer"
                  onClick={() => select(place.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(place.key);
                    }
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={PIN_FILL[dominantColor(place.wines)] ?? PIN_FILL.autre}
                    stroke={isSelected ? '#c9a646' : '#fffdf7'}
                    strokeWidth={isSelected ? 5 : 2.5}
                  />
                  <text
                    x={x}
                    y={y}
                    fontSize={Math.max(20, radius * 0.92)}
                    fontWeight="700"
                    fill="#fffdf7"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="pointer-events-none select-none"
                  >
                    {place.bottles}
                  </text>
                </g>
              );
            })}

            {/*
              Les noms sont rendus après tous les points, dans leur propre
              calque : dessinés avec chaque point, un petit voisin passait
              par-dessus le nom d'un gros. Masqués en bloc sous `sm`, où
              aucun ne tient — la liste à côté nomme déjà chaque lieu.
            */}
            <g aria-hidden="true" className="hidden sm:block">
              {places.map((place) => {
                if (!labelledKeys.has(place.key)) {
                  return null;
                }
                const { x, y } = projectLatLon(place.coords);
                const radius = pinRadius({ bottles: place.bottles, precision });
                return (
                  <text
                    key={place.key}
                    x={x}
                    y={labelTop({ y, radius }) + LABEL_FONT_SIZE * 0.8}
                    fontSize={LABEL_FONT_SIZE}
                    fill="#20342b"
                    stroke="#ffffff"
                    strokeWidth={6}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {place.label}
                  </text>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block bg-[#7a2331]" /> Rouge
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block bg-[#c9a646]" /> Blanc
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block bg-[#e0a3ad]" /> Rosé
          </span>
          <span>Taille du point = nombre de bouteilles</span>
        </div>

        {unlocated.length > 0 && (
          <p className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span className="text-forest">
              {unlocated.length} référence{unlocated.length > 1 ? 's' : ''} hors carte
            </span>{' '}
            — {unlocated.map((wine) => wine.name).join(', ')} : sans région connue de la table de coordonnées,
            elles ne sont pas placées au hasard.
          </p>
        )}
      </div>

      <div className="bg-white rounded">
        <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs uppercase tracking-wide text-gray-500">
            {selected ? 'Sélection' : "Vue d'ensemble"}
          </span>
          {selected && (
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="text-xs text-forest underline underline-offset-2"
            >
              ← Tout voir
            </button>
          )}
        </div>
        {selected ? (
          <SelectedPlace place={selected} />
        ) : (
          <PlaceRanking places={places} maxBottles={maxBottles} onSelect={select} precision={precision} />
        )}
      </div>
    </div>
  );
};

const SelectedPlace = ({ place }: { place: MapPlace }): ReactElement => {
  return (
    <div className="p-4">
      <h3 className="text-lg mb-0.5">{place.label}</h3>
      <p className="text-xs text-gray-500 mb-2">
        {factLine([
          place.parentRegion,
          `${place.wines.length} référence${place.wines.length > 1 ? 's' : ''}`,
          `${place.bottles} bouteille${place.bottles > 1 ? 's' : ''}`,
        ])}
      </p>
      <ul className="divide-y divide-gray-100">
        {place.wines.map((wine) => (
          <li key={wine.id} className="py-2 flex items-baseline gap-2.5">
            <i
              className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 translate-y-0.5 ${wineColorDotClass(wine.color)}`}
            />
            <span className="min-w-0 flex-1">
              <Link href={`/bottles/${wine.id}`} className="text-forest underline text-sm">
                {wine.name} {wine.vintage ?? 'NV'}
              </Link>
              <span className="block text-xs text-gray-500 truncate">{wine.producer ?? '—'}</span>
            </span>
            <span className="text-xs text-gray-500 whitespace-nowrap">×{wine.quantity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const PlaceRanking = ({
  places,
  maxBottles,
  onSelect,
  precision,
}: {
  places: readonly MapPlace[];
  maxBottles: number;
  onSelect: (key: string) => void;
  precision: MapPrecision;
}): ReactElement => {
  if (places.length === 0) {
    return (
      <p className="p-4 text-sm text-gray-400">
        Aucune bouteille en cave n&apos;a de région reconnue : rien à placer sur la carte.
      </p>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-gray-500 mb-2">
        {precision === 'subRegion'
          ? 'Points placés à la sous-région quand elle est connue. Touche un point pour voir les vins.'
          : 'Points placés à la région. Touche un point pour voir les vins.'}
      </p>
      <ul className="divide-y divide-gray-100">
        {places.map((place) => (
          <li key={place.key}>
            <button
              type="button"
              onClick={() => onSelect(place.key)}
              className="w-full text-left py-2 flex items-center gap-3 hover:bg-gray-50 rounded"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">{place.label}</span>
                <i
                  className="block h-1 rounded mt-1"
                  style={{
                    width: `${Math.round((place.bottles / maxBottles) * 100)}%`,
                    backgroundColor: PIN_FILL[dominantColor(place.wines)] ?? PIN_FILL.autre,
                  }}
                />
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">{place.bottles} bt.</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
