import { describe, it, expect } from 'vitest';
import { buildMapClusters, spiderfyCluster, type MapCluster, type MapPoint } from './mapClusters';
import { buildMapPlaces, SUB_REGION_COORDS, type BottleForMap } from './wineMap';
import { FRANCE_VIEWBOX, projectLatLon } from '../lib/franceMap';
import type { MapPlace } from './interfaces/map-place.interface';

const [, , VIEW_WIDTH = 0, VIEW_HEIGHT = 0] = FRANCE_VIEWBOX.split(' ').map(Number);

/** Le rayon du rendu : base + racine, comme `pinRadius` côté composant. */
const radiusOf = (bottles: number): number => 11 + 3.6 * Math.sqrt(bottles);

const place = (label: string, bottles: number): MapPlace => ({
  key: `sub:${label}`,
  label,
  parentRegion: null,
  coords: { lat: 0, lon: 0 },
  bottles,
  wines: [],
});

const point = ({
  label,
  bottles,
  x,
  y,
}: {
  label: string;
  bottles: number;
  x: number;
  y: number;
}): MapPoint => ({
  place: place(label, bottles),
  x,
  y,
  radius: radiusOf(bottles),
});

const bottle = (over: Partial<BottleForMap>): BottleForMap => ({
  id: 'b1',
  name: 'Vin',
  producer: null,
  vintage: null,
  color: 'rouge',
  quantity: 1,
  region: 'Bordeaux',
  subRegion: null,
  ...over,
});

const labelsOf = (cluster: { points: readonly MapPoint[] }): string[] => {
  return cluster.points.map((member) => member.place.label);
};

describe('buildMapClusters', () => {
  it('laisse seuls les points qui ne se touchent pas', () => {
    const clusters = buildMapClusters({
      radiusOf,
      points: [
        point({ label: 'Chablis', bottles: 2, x: 100, y: 100 }),
        point({ label: 'Jura', bottles: 2, x: 400, y: 400 }),
      ],
    });

    expect(clusters.map(labelsOf)).toEqual([['Chablis'], ['Jura']]);
  });

  it('fusionne deux points superposés en une grappe qui porte le total', () => {
    const clusters = buildMapClusters({
      radiusOf,
      points: [
        point({ label: 'Haut-Médoc', bottles: 9, x: 300, y: 620 }),
        point({ label: 'Blaye-Bourg', bottles: 2, x: 308, y: 626 }),
      ],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.bottles).toBe(11);
    expect(labelsOf(clusters[0] ?? { points: [] })).toEqual(['Haut-Médoc', 'Blaye-Bourg']);
  });

  /**
   * A ne touche pas C, mais tous deux touchent B. Sans transitivité, B se
   * retrouverait dans deux grappes — et serait compté deux fois.
   */
  it('regroupe en chaîne', () => {
    const clusters = buildMapClusters({
      radiusOf,
      points: [
        point({ label: 'A', bottles: 1, x: 100, y: 100 }),
        point({ label: 'C', bottles: 1, x: 150, y: 100 }),
        point({ label: 'B', bottles: 1, x: 125, y: 100 }),
      ],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.points).toHaveLength(3);
  });

  /**
   * Le rayon fusionné est plus grand que chacun de ses membres : s'en
   * servir pour chercher de nouveaux voisins ferait boule de neige. Ici
   * « Loin » est hors des disques d'origine mais dans le disque fusionné,
   * et doit rester seul.
   */
  it('ne regroupe pas en boule de neige sur le rayon fusionné', () => {
    const clusters = buildMapClusters({
      radiusOf: (bottles) => 10 * bottles,
      points: [
        { place: place('Gros', 5), x: 100, y: 100, radius: 12 },
        { place: place('Voisin', 5), x: 120, y: 100, radius: 12 },
        { place: place('Loin', 1), x: 170, y: 100, radius: 12 },
      ],
    });

    expect(clusters.map(labelsOf)).toEqual([['Gros', 'Voisin'], ['Loin']]);
  });

  it('trie les grappes du plus fourni au moins fourni', () => {
    const clusters = buildMapClusters({
      radiusOf,
      points: [
        point({ label: 'Petit', bottles: 1, x: 100, y: 100 }),
        point({ label: 'Gros', bottles: 12, x: 400, y: 400 }),
      ],
    });

    expect(clusters.map((cluster) => cluster.bottles)).toEqual([12, 1]);
  });

  /**
   * Le test qui tient la promesse du regroupement : sur toutes les
   * sous-régions de la table, à la fois en vue régionale et en vue fine, la
   * somme des disques dessinés doit égaler le nombre de bouteilles placées.
   * Un point avalé par un autre, ou compté deux fois, le ferait échouer.
   */
  it.each(['region', 'subRegion'] as const)(
    'affiche exactement les bouteilles placées, en précision %s',
    (precision) => {
      const bottles = Object.keys(SUB_REGION_COORDS).map((subRegion, index) =>
        bottle({
          id: `b${index}`,
          region: 'Bordeaux',
          subRegion,
          quantity: (index % 9) + 1,
        }),
      );

      const { places, unlocated } = buildMapPlaces({ bottles, precision });
      expect(unlocated).toEqual([]);

      const clusters = buildMapClusters({
        radiusOf,
        points: places.map((found) => ({
          place: found,
          ...projectLatLon(found.coords),
          radius: radiusOf(found.bottles),
        })),
      });

      const placed = places.reduce((sum, found) => sum + found.bottles, 0);
      const drawn = clusters.reduce((sum, cluster) => sum + cluster.bottles, 0);
      expect(drawn).toBe(placed);

      const keys = clusters.flatMap((cluster) => cluster.points.map((member) => member.place.key));
      expect(new Set(keys).size).toBe(places.length);
    },
  );
});

describe('spiderfyCluster', () => {
  const clusterOf = (count: number): MapCluster => {
    const points = Array.from({ length: count }, (_, index) =>
      point({ label: `L${index}`, bottles: index + 1, x: 300, y: 620 }),
    );
    const cluster = buildMapClusters({ radiusOf, points })[0];
    if (!cluster) {
      throw new Error('grappe attendue');
    }
    return cluster;
  };

  it.each([2, 5, 9, 15])('déplie %i points sans qu’aucun n’en recouvre un autre', (count) => {
    const positions = spiderfyCluster({
      cluster: clusterOf(count),
      bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
      gap: 8,
    });

    expect(positions).toHaveLength(count);
    for (const a of positions) {
      for (const b of positions) {
        if (a === b) {
          continue;
        }
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        expect(distance).toBeGreaterThanOrEqual(a.point.radius + b.point.radius);
      }
    }
  });

  it('garde l’étoile dans le cadre, même collée au bord', () => {
    const points = Array.from({ length: 6 }, (_, index) =>
      point({ label: `L${index}`, bottles: 4, x: 8, y: 8 }),
    );
    const cluster = buildMapClusters({ radiusOf, points })[0];
    if (!cluster) {
      throw new Error('grappe attendue');
    }

    const positions = spiderfyCluster({
      cluster,
      bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
      gap: 8,
    });

    for (const position of positions) {
      expect(position.x - position.point.radius).toBeGreaterThanOrEqual(0);
      expect(position.y - position.point.radius).toBeGreaterThanOrEqual(0);
      expect(position.x + position.point.radius).toBeLessThanOrEqual(VIEW_WIDTH);
      expect(position.y + position.point.radius).toBeLessThanOrEqual(VIEW_HEIGHT);
    }
  });
});
