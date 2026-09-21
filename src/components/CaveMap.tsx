'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FRANCE_PATHS, FRANCE_VIEWBOX, projectLatLon } from '@/lib/franceMap';
import { buildMapPlaces, type BottleForMap, type MapPlace, type MapPrecision } from '@/domain/wineMap';
import { buildMapClusters, spiderfyCluster, type MapCluster } from '@/domain/mapClusters';
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

/** Teinte d'une couleur de vin, ou le gris des « autres » quand elle n'est pas dans la charte. */
const fillOf = (color: string): string => PIN_FILL[color] ?? '#8a8577';

/** Fond d'une grappe : l'encre de la charte, pour qu'elle ne se lise pas comme une couleur de vin. */
const CLUSTER_FILL = '#20342b';

/** Cadre de la carte, lu une fois depuis le `viewBox` qui sert au rendu. */
const [, , VIEW_WIDTH = 1000, VIEW_HEIGHT = 1000] = FRANCE_VIEWBOX.split(' ').map(Number);

/** Bouteilles par couleur, à la quantité et non au nombre de références. */
const colorTotals = (wines: readonly BottleForMap[]): ReadonlyMap<string, number> => {
  const totals = new Map<string, number>();
  for (const wine of wines) {
    const key = wine.color ?? 'autre';
    totals.set(key, (totals.get(key) ?? 0) + wine.quantity);
  }
  return totals;
};

/**
 * Couleur dominante d'un lieu, à la quantité : trois cartons de blanc
 * pèsent plus qu'une unique bouteille de rouge, et c'est bien ce que le
 * point doit dire.
 */
const dominantColor = (wines: readonly BottleForMap[]): string => {
  let best = 'autre';
  let bestTotal = -1;
  for (const [color, total] of colorTotals(wines)) {
    if (total > bestTotal) {
      best = color;
      bestTotal = total;
    }
  }
  return best;
};

const placeFill = (place: MapPlace): string => fillOf(dominantColor(place.wines));

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

/** Marge entre deux disques dépliés, et entre un disque et le bord de la carte. */
const SPIDER_GAP = 14;

const arcPath = ({
  cx,
  cy,
  radius,
  from,
  to,
}: {
  cx: number;
  cy: number;
  radius: number;
  from: number;
  to: number;
}): string => {
  const x1 = cx + Math.cos(from) * radius;
  const y1 = cy + Math.sin(from) * radius;
  const x2 = cx + Math.cos(to) * radius;
  const y2 = cy + Math.sin(to) * radius;
  const large = to - from > Math.PI ? 1 : 0;
  return `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2}`;
};

/**
 * Parts d'anneau d'une grappe, une par couleur.
 *
 * Le disque d'une grappe est neutre — il compte des lieux, pas un vin — et
 * l'anneau rend malgré tout ce qu'il y a dedans, sans prétendre qu'une
 * couleur unique résume le tout.
 */
const clusterArcs = (cluster: MapCluster): readonly { color: string; path: string }[] => {
  const wines = cluster.points.flatMap((point) => point.place.wines);
  const totals = colorTotals(wines);
  const radius = cluster.radius + 6;
  let from = -Math.PI / 2;
  return Array.from(totals).map(([color, total]) => {
    const to = from + (total / cluster.bottles) * Math.PI * 2;
    const path = arcPath({ cx: cluster.x, cy: cluster.y, radius, from, to });
    from = to;
    return { color: fillOf(color), path };
  });
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
 * Un disque tel qu'il est effectivement dessiné : un lieu seul, une grappe
 * repliée, ou un lieu déplié dans une étoile. Le rendu ne connaît que ça,
 * ce qui lui évite trois branches par élément (point, nom, clic).
 */
interface Disc {
  readonly key: string;
  readonly label: string;
  readonly bottles: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly fill: string;
  /** Le lieu, quand le disque en représente un seul — `null` pour une grappe repliée. */
  readonly place: MapPlace | null;
  /** La grappe, quand le disque en est une repliée — `null` sinon. */
  readonly cluster: MapCluster | null;
  /** Mis en retrait pendant qu'une autre grappe est dépliée. */
  readonly faded: boolean;
}

/**
 * Noms affichables sans chevauchement.
 *
 * Deux sous-régions voisines (Graves et Sauternais, Côte de Nuits et Côte
 * de Beaune) sont à vingt kilomètres : leurs noms se superposaient en
 * bouillie illisible, et une étoile dépliée en aligne autant que de lieux.
 * On parcourt les disques du plus fourni au moins fourni et on abandonne le
 * nom qui heurterait un disque ou un nom déjà posé. Le disque, lui, reste :
 * c'est le nom qui est de trop, pas le lieu, et le panneau les nomme tous.
 */
const visibleLabelKeys = (discs: readonly Disc[]): ReadonlySet<string> => {
  const taken: Box[] = discs.map((disc) => ({
    x1: disc.x - disc.radius,
    y1: disc.y - disc.radius,
    x2: disc.x + disc.radius,
    y2: disc.y + disc.radius,
  }));

  const visible = new Set<string>();
  for (const disc of discs) {
    const halfWidth = labelHalfWidth(disc.label);
    const top = labelTop({ y: disc.y, radius: disc.radius });
    const box: Box = { x1: disc.x - halfWidth, y1: top, x2: disc.x + halfWidth, y2: top + LABEL_FONT_SIZE };
    if (taken.some((other) => overlaps(box, other))) {
      continue;
    }
    taken.push(box);
    visible.add(disc.key);
  }
  return visible;
};

/** Trait reliant une grappe dépliée à chacune de ses branches. */
interface Leader {
  readonly key: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const clusterLabel = (cluster: MapCluster): string => {
  return `${cluster.points.length} lieux, ${cluster.bottles} bouteille${cluster.bottles > 1 ? 's' : ''}`;
};

const precisionButtonClass = (active: boolean): string => {
  return `px-3 py-1.5 text-xs ${active ? 'bg-forest text-cream' : 'text-forest'}`;
};

export const CaveMap = ({ bottles }: { bottles: readonly BottleForMap[] }): ReactElement => {
  const [precision, setPrecision] = useState<MapPrecision>('region');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [openClusterKey, setOpenClusterKey] = useState<string | null>(null);

  const { places, unlocated } = useMemo(() => {
    return buildMapPlaces({ bottles, precision });
  }, [bottles, precision]);

  const clusters = useMemo(() => {
    return buildMapClusters({
      radiusOf: (count) => pinRadius({ bottles: count, precision }),
      points: places.map((place) => ({
        place,
        ...projectLatLon(place.coords),
        radius: pinRadius({ bottles: place.bottles, precision }),
      })),
    });
  }, [places, precision]);

  /** La grappe dépliée : une grappe d'un seul lieu n'a rien à déplier. */
  const openCluster = useMemo(() => {
    const found = clusters.find((cluster) => cluster.key === openClusterKey) ?? null;
    return found && found.points.length > 1 ? found : null;
  }, [clusters, openClusterKey]);

  const { discs, leaders } = useMemo(() => {
    const out: Disc[] = [];
    const lines: Leader[] = [];

    for (const cluster of clusters) {
      const isOpen = cluster === openCluster;
      const faded = openCluster !== null && !isOpen;

      if (isOpen) {
        for (const spread of spiderfyCluster({
          cluster,
          bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
          gap: SPIDER_GAP,
        })) {
          const { place } = spread.point;
          lines.push({ key: place.key, x1: cluster.x, y1: cluster.y, x2: spread.x, y2: spread.y });
          out.push({
            key: place.key,
            label: place.label,
            bottles: place.bottles,
            x: spread.x,
            y: spread.y,
            radius: spread.point.radius,
            fill: placeFill(place),
            place,
            cluster: null,
            faded: false,
          });
        }
        continue;
      }

      const only = cluster.points.length === 1 ? cluster.points[0] : null;
      if (only) {
        out.push({
          key: only.place.key,
          label: only.place.label,
          bottles: only.place.bottles,
          x: only.x,
          y: only.y,
          radius: only.radius,
          fill: placeFill(only.place),
          place: only.place,
          cluster: null,
          faded,
        });
        continue;
      }

      out.push({
        key: cluster.key,
        label: `${cluster.points.length} lieux`,
        bottles: cluster.bottles,
        x: cluster.x,
        y: cluster.y,
        radius: cluster.radius,
        fill: CLUSTER_FILL,
        place: null,
        cluster,
        faded,
      });
    }

    return { discs: out, leaders: lines };
  }, [clusters, openCluster]);

  // Les noms ne se calculent que sur ce qui est au premier plan : un nom
  // sur un disque en retrait ne serait qu'un obstacle de plus.
  const labelledKeys = useMemo(() => visibleLabelKeys(discs.filter((disc) => !disc.faded)), [discs]);

  const selected = places.find((place) => place.key === selectedKey) ?? null;
  const maxBottles = places[0]?.bottles ?? 1;

  const reset = (): void => {
    setSelectedKey(null);
    setOpenClusterKey(null);
  };

  const changePrecision = (next: MapPrecision): void => {
    setPrecision(next);
    // Le lieu sélectionné n'existe plus forcément à l'autre niveau : un
    // « Haut-Médoc » n'a pas d'équivalent en vue régionale.
    reset();
  };

  const select = (key: string): void => {
    setSelectedKey((current) => (current === key ? null : key));
  };

  const activate = (disc: Disc): void => {
    if (disc.cluster) {
      // Une grappe se déplie et se replie au même geste ; le panneau suit.
      setSelectedKey(null);
      setOpenClusterKey((current) => (current === disc.cluster?.key ? null : (disc.cluster?.key ?? null)));
      return;
    }
    select(disc.key);
  };

  const panelPlaces = openCluster ? openCluster.points.map((point) => point.place) : places;

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

            {/*
              Le reste de la carte passe en retrait pendant qu'une étoile est
              dépliée : ses branches s'étalent sur les voisins, et deux
              grappes qui se marchent dessus ne se lisent plus. Calque à
              part, dessiné avant, donc toujours dessous.
            */}
            <g opacity={0.16} aria-hidden="true">
              {discs
                .filter((disc) => disc.faded)
                .map((disc) => (
                  <Pin key={disc.key} disc={disc} selected={false} />
                ))}
            </g>

            <g aria-hidden="true">
              {leaders.map((leader) => (
                <line
                  key={leader.key}
                  x1={leader.x1}
                  y1={leader.y1}
                  x2={leader.x2}
                  y2={leader.y2}
                  stroke="#8a8577"
                  strokeWidth={2}
                />
              ))}
              {openCluster && <circle cx={openCluster.x} cy={openCluster.y} r={4} fill="#8a8577" />}
            </g>

            {discs
              .filter((disc) => !disc.faded)
              .map((disc) => (
                <g
                  key={disc.key}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    disc.cluster
                      ? clusterLabel(disc.cluster)
                      : `${disc.label} : ${disc.bottles} bouteille${disc.bottles > 1 ? 's' : ''}`
                  }
                  aria-pressed={disc.cluster ? false : disc.key === selectedKey}
                  aria-expanded={disc.cluster ? false : undefined}
                  className="cursor-pointer"
                  onClick={() => activate(disc)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      activate(disc);
                    }
                  }}
                >
                  <Pin disc={disc} selected={disc.key === selectedKey} />
                </g>
              ))}

            {/*
              Les noms sont rendus après tous les points, dans leur propre
              calque : dessinés avec chaque point, un petit voisin passait
              par-dessus le nom d'un gros. Masqués en bloc sous `sm`, où
              aucun ne tient — la liste à côté nomme déjà chaque lieu.
            */}
            <g aria-hidden="true" className="hidden sm:block">
              {discs.map((disc) => {
                if (disc.faded || !labelledKeys.has(disc.key)) {
                  return null;
                }
                return (
                  <text
                    key={disc.key}
                    x={disc.x}
                    y={labelTop({ y: disc.y, radius: disc.radius }) + LABEL_FONT_SIZE * 0.8}
                    fontSize={LABEL_FONT_SIZE}
                    fill="#20342b"
                    stroke="#ffffff"
                    strokeWidth={6}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {disc.label}
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
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block bg-[#20342b]" /> Lieux groupés
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
            {selected ? 'Sélection' : openCluster ? 'Lieux groupés' : "Vue d'ensemble"}
          </span>
          {(selected ?? openCluster) && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-forest underline underline-offset-2"
            >
              ← Tout voir
            </button>
          )}
        </div>
        {selected ? (
          <SelectedPlace place={selected} />
        ) : (
          <PlaceRanking
            places={panelPlaces}
            maxBottles={maxBottles}
            onSelect={select}
            hint={
              openCluster
                ? 'Ces lieux sont trop proches pour tenir côte à côte : le point les rassemble, et l’étoile les déplie. Le reste de la cave est toujours sur la carte, en retrait.'
                : precision === 'subRegion'
                  ? 'Points placés à la sous-région quand elle est connue. Touche un point pour voir les vins.'
                  : 'Points placés à la région. Touche un point pour voir les vins.'
            }
          />
        )}
      </div>
    </div>
  );
};

const Pin = ({ disc, selected }: { disc: Disc; selected: boolean }): ReactElement => {
  return (
    <>
      {disc.cluster?.points.length === 1
        ? null
        : disc.cluster &&
          clusterArcs(disc.cluster).map((arc) => (
            <path
              key={arc.path}
              d={arc.path}
              stroke={arc.color}
              strokeWidth={5}
              fill="none"
              className="pointer-events-none"
            />
          ))}
      <circle
        cx={disc.x}
        cy={disc.y}
        r={disc.radius}
        fill={disc.fill}
        stroke={selected ? '#c9a646' : '#fffdf7'}
        strokeWidth={selected ? 5 : 2.5}
      />
      <text
        x={disc.x}
        y={disc.y}
        fontSize={Math.max(20, disc.radius * 0.92)}
        fontWeight="700"
        fill="#fffdf7"
        textAnchor="middle"
        dominantBaseline="central"
        className="pointer-events-none select-none"
      >
        {disc.bottles}
      </text>
    </>
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
  hint,
}: {
  places: readonly MapPlace[];
  maxBottles: number;
  onSelect: (key: string) => void;
  hint: string;
}): ReactElement => {
  if (places.length === 0) {
    return (
      <p className="p-4 text-sm text-gray-400">
        Aucune bouteille en cave n&apos;a de région reconnue : rien à placer sur la carte.
      </p>
    );
  }

  const total = places.reduce((sum, place) => sum + place.bottles, 0);

  return (
    <div className="p-4">
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
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
                    backgroundColor: placeFill(place),
                  }}
                />
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">{place.bottles} bt.</span>
            </button>
          </li>
        ))}
      </ul>
      {/*
        Le total dit toujours sur quoi porte la liste. Sans lui, la liste
        d'une grappe se lit comme la cave entière : trois champagnes
        affichés sur quatre, et on croit en avoir perdu un.
      */}
      <p className="pt-2 mt-1 border-t border-gray-100 text-xs text-gray-500">
        <span className="text-forest">
          {total} bouteille{total > 1 ? 's' : ''}
        </span>{' '}
        sur {places.length} lieu
        {places.length > 1 ? 'x' : ''}
      </p>
    </div>
  );
};
