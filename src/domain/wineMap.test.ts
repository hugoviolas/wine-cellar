import { describe, it, expect } from 'vitest';
import { SUB_REGIONS_BY_REGION, WINE_REGIONS, geographyKey } from './wineGeography';
import {
  EXTRA_ZONE_COORDS,
  REGION_COORDS,
  SUB_REGION_COORDS,
  buildMapPlaces,
  resolveMapPlace,
  type BottleForMap,
} from './wineMap';
import { projectLatLon, FRANCE_VIEWBOX } from '../lib/franceMap';

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

describe('tables de coordonnées', () => {
  it('couvre toutes les régions viticoles', () => {
    const missing = WINE_REGIONS.filter((region) => !(region in REGION_COORDS));
    expect(missing).toEqual([]);
  });

  /**
   * TypeScript ne peut pas l'exiger (les sous-régions sont typées
   * `readonly string[]`), donc c'est ce test qui tient la promesse : une
   * sous-région ajoutée à `SUB_REGIONS_BY_REGION` sans coordonnées
   * disparaîtrait sinon de la carte sans bruit.
   */
  it('couvre toutes les sous-régions déclarées', () => {
    const known = new Set(Object.keys(SUB_REGION_COORDS).map(geographyKey));
    const missing = Object.values(SUB_REGIONS_BY_REGION)
      .flat()
      .filter((subRegion) => !known.has(geographyKey(subRegion)));
    expect(missing).toEqual([]);
  });

  it('place chaque lieu dans le cadre de la carte', () => {
    const [, , width, height] = FRANCE_VIEWBOX.split(' ').map(Number);
    const all = [
      ...Object.values(REGION_COORDS),
      ...Object.values(SUB_REGION_COORDS),
      ...Object.values(EXTRA_ZONE_COORDS),
    ];
    for (const coords of all) {
      const { x, y } = projectLatLon(coords);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(width as number);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height as number);
    }
  });
});

describe('resolveMapPlace', () => {
  it('place à la région en précision régionale, même si la sous-région est connue', () => {
    const place = resolveMapPlace({ region: 'Bordeaux', subRegion: 'Haut-Médoc', precision: 'region' });
    expect(place?.label).toBe('Bordeaux');
    expect(place?.coords).toEqual(REGION_COORDS.Bordeaux);
  });

  it('descend à la sous-région en précision fine, en gardant la région parente', () => {
    const place = resolveMapPlace({ region: 'Bordeaux', subRegion: 'Haut-Médoc', precision: 'subRegion' });
    expect(place?.label).toBe('Haut-Médoc');
    expect(place?.parentRegion).toBe('Bordeaux');
  });

  it('retombe sur la région quand la sous-région est inconnue ou absente', () => {
    const sansSousRegion = resolveMapPlace({ region: 'Provence', subRegion: null, precision: 'subRegion' });
    expect(sansSousRegion?.label).toBe('Provence');

    const horsTable = resolveMapPlace({
      region: 'Loire',
      subRegion: 'Coteaux du Vendômois',
      precision: 'subRegion',
    });
    expect(horsTable?.label).toBe('Loire');
  });

  it('reconnaît une région mal accentuée ou en capitales', () => {
    expect(resolveMapPlace({ region: 'RHONE', subRegion: null, precision: 'region' })?.label).toBe('Rhône');
  });

  it('place les zones françaises hors liste viticole, quelle que soit l’orthographe', () => {
    // « Hautes Alpes » produit en IGP, hors du découpage de WINE_REGIONS :
    // sans cette table, la bouteille tombait en « région inconnue ».
    expect(resolveMapPlace({ region: 'Hautes Alpes', subRegion: null, precision: 'region' })?.label).toBe(
      'Hautes-Alpes',
    );
    // Cas réel d'une fiche : la sous-région répète la région. En précision
    // fine, elle n'est pas dans la table des sous-régions, donc on retombe
    // sur la région — qui, elle, est désormais connue.
    expect(
      resolveMapPlace({ region: 'Hautes Alpes', subRegion: 'Hautes-Alpes', precision: 'subRegion' })?.label,
    ).toBe('Hautes-Alpes');
  });

  it('laisse hors carte ce qui n’est pas en France métropolitaine', () => {
    // Le fond de carte est la France : y poser un rhum ou un rioja
    // n'aurait aucun sens, ils sont listés à part.
    expect(resolveMapPlace({ region: 'Martinique', subRegion: null, precision: 'region' })).toBeNull();
    expect(resolveMapPlace({ region: 'Rioja', subRegion: null, precision: 'region' })).toBeNull();
  });

  it('ne place pas une bouteille dont la région est hors table', () => {
    expect(resolveMapPlace({ region: 'Rioja', subRegion: null, precision: 'region' })).toBeNull();
    expect(resolveMapPlace({ region: null, subRegion: null, precision: 'region' })).toBeNull();
  });

  it('distingue une région et une sous-région homonymes par leur clé', () => {
    const region = resolveMapPlace({ region: 'Bordeaux', subRegion: null, precision: 'region' });
    const sub = resolveMapPlace({ region: 'Loire', subRegion: 'Touraine', precision: 'subRegion' });
    expect(region?.key).toBe('region:Bordeaux');
    expect(sub?.key).toBe('sub:Touraine');
  });
});

describe('buildMapPlaces', () => {
  it('regroupe par lieu, additionne les quantités et trie du plus fourni au moins fourni', () => {
    const { places } = buildMapPlaces({
      precision: 'region',
      bottles: [
        bottle({ id: '1', region: 'Bordeaux', quantity: 2 }),
        bottle({ id: '2', region: 'Bordeaux', quantity: 3 }),
        bottle({ id: '3', region: 'Bourgogne', quantity: 12 }),
        bottle({ id: '4', region: 'Jura', quantity: 1 }),
      ],
    });

    expect(places.map((place) => [place.label, place.bottles, place.wines.length])).toEqual([
      ['Bourgogne', 12, 1],
      ['Bordeaux', 5, 2],
      ['Jura', 1, 1],
    ]);
  });

  it('sépare les bouteilles qu’aucune coordonnée ne permet de placer', () => {
    const { places, unlocated } = buildMapPlaces({
      precision: 'region',
      bottles: [
        bottle({ id: '1', region: 'Bordeaux' }),
        bottle({ id: '2', region: 'Rioja', name: 'Rioja Reserva' }),
        bottle({ id: '3', region: null, name: 'Bière' }),
      ],
    });

    expect(places).toHaveLength(1);
    expect(unlocated.map((wine) => wine.name)).toEqual(['Rioja Reserva', 'Bière']);
  });

  it('éclate une région en ses sous-régions en précision fine', () => {
    const bottles = [
      bottle({ id: '1', region: 'Bordeaux', subRegion: 'Haut-Médoc', quantity: 2 }),
      bottle({ id: '2', region: 'Bordeaux', subRegion: 'Graves', quantity: 1 }),
      bottle({ id: '3', region: 'Bordeaux', subRegion: null, quantity: 4 }),
    ];

    expect(buildMapPlaces({ bottles, precision: 'region' }).places).toHaveLength(1);

    const fine = buildMapPlaces({ bottles, precision: 'subRegion' }).places;
    expect(fine.map((place) => [place.label, place.bottles])).toEqual([
      ['Bordeaux', 4],
      ['Haut-Médoc', 2],
      ['Graves', 1],
    ]);
  });

  it('départage deux lieux à égalité par leur nom', () => {
    const { places } = buildMapPlaces({
      precision: 'region',
      bottles: [bottle({ id: '1', region: 'Savoie' }), bottle({ id: '2', region: 'Corse' })],
    });

    expect(places.map((place) => place.label)).toEqual(['Corse', 'Savoie']);
  });
});
