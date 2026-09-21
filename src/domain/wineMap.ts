import { geographyKey, type WineRegion } from './wineGeography';
import type { MapCoords } from './interfaces/map-coords.interface';
import type { MapPlace } from './interfaces/map-place.interface';
import type { BottleForMap } from './interfaces/bottle-for-map.interface';
import type { BuildMapPlacesArgs } from './interfaces/build-map-places-args.interface';
import type { MapPlacesResult } from './interfaces/map-places-result.interface';
import type { ResolveMapPlaceArgs } from './interfaces/resolve-map-place-args.interface';

export type { MapCoords, MapPlace, BottleForMap, MapPlacesResult };

/**
 * Niveau de placement des points : à la région, ou au plus précis connu.
 * En `subRegion`, une bouteille dont la sous-région est inconnue retombe
 * sur sa région — le niveau est un maximum, pas une exigence.
 */
export type MapPrecision = 'region' | 'subRegion';

/**
 * Coordonnées des régions viticoles : le cœur du vignoble, pas la
 * préfecture. Bordeaux pointe sur les vignes de la rive gauche, pas sur la
 * place de la Bourse — c'est la seule façon qu'un point « Bordeaux » et un
 * point « Haut-Médoc » racontent la même géographie à deux précisions.
 *
 * Le `Record<WineRegion, ...>` est volontaire : ajouter une région à
 * `WINE_REGIONS` sans lui donner de coordonnées ne compile pas.
 */
export const REGION_COORDS: Readonly<Record<WineRegion, MapCoords>> = {
  Alsace: { lat: 48.2, lon: 7.4 },
  Beaujolais: { lat: 46.1, lon: 4.66 },
  Bordeaux: { lat: 44.92, lon: -0.55 },
  Bourgogne: { lat: 47.05, lon: 4.83 },
  Champagne: { lat: 49.05, lon: 4.03 },
  Corse: { lat: 42.2, lon: 9.05 },
  Jura: { lat: 46.75, lon: 5.7 },
  'Languedoc-Roussillon': { lat: 43.35, lon: 2.95 },
  Loire: { lat: 47.35, lon: 0.7 },
  Provence: { lat: 43.45, lon: 6.1 },
  Rhône: { lat: 44.55, lon: 4.8 },
  Savoie: { lat: 45.55, lon: 6.05 },
  'Sud-Ouest': { lat: 44.05, lon: 0.55 },
};

/**
 * Coordonnées des sous-régions de `SUB_REGIONS_BY_REGION`.
 *
 * TypeScript ne peut pas exiger l'exhaustivité ici — les sous-régions y
 * sont typées `readonly string[]`, donc aucune union ne s'en déduit. Un
 * test la vérifie à la place : une sous-région ajoutée sans coordonnées
 * fait échouer la suite plutôt que de disparaître silencieusement de la
 * carte.
 */
export const SUB_REGION_COORDS: Readonly<Record<string, MapCoords>> = {
  // — Alsace —
  'Bas-Rhin': { lat: 48.55, lon: 7.45 },
  'Haut-Rhin': { lat: 48.05, lon: 7.32 },
  // — Beaujolais —
  'Crus du Beaujolais': { lat: 46.18, lon: 4.69 },
  // — Bordeaux —
  Médoc: { lat: 45.28, lon: -0.88 },
  'Haut-Médoc': { lat: 45.1, lon: -0.78 },
  Graves: { lat: 44.72, lon: -0.52 },
  Sauternais: { lat: 44.53, lon: -0.33 },
  Libournais: { lat: 44.9, lon: -0.15 },
  'Blaye-Bourg': { lat: 45.13, lon: -0.66 },
  'Entre-deux-Mers': { lat: 44.75, lon: -0.22 },
  // — Bourgogne —
  Chablis: { lat: 47.82, lon: 3.8 },
  'Côte de Nuits': { lat: 47.16, lon: 4.95 },
  'Côte de Beaune': { lat: 46.98, lon: 4.8 },
  'Côte Chalonnaise': { lat: 46.75, lon: 4.72 },
  Mâconnais: { lat: 46.4, lon: 4.75 },
  // — Champagne —
  'Montagne de Reims': { lat: 49.17, lon: 4.05 },
  'Côte des Blancs': { lat: 48.92, lon: 4.02 },
  'Vallée de la Marne': { lat: 49.04, lon: 3.72 },
  'Côte des Bar': { lat: 48.1, lon: 4.55 },
  // — Languedoc-Roussillon —
  Languedoc: { lat: 43.45, lon: 3.3 },
  Roussillon: { lat: 42.7, lon: 2.75 },
  // — Loire —
  'Pays nantais': { lat: 47.2, lon: -1.42 },
  'Anjou-Saumur': { lat: 47.25, lon: -0.33 },
  Touraine: { lat: 47.25, lon: 0.78 },
  'Centre-Loire': { lat: 47.33, lon: 2.85 },
  // — Rhône —
  'Rhône septentrional': { lat: 45.1, lon: 4.82 },
  'Rhône méridional': { lat: 44.08, lon: 4.83 },
  // — Sud-Ouest —
  Bergeracois: { lat: 44.85, lon: 0.48 },
  Quercy: { lat: 44.45, lon: 1.25 },
  Gascogne: { lat: 43.75, lon: 0.3 },
};

/**
 * Zones françaises qui ne sont pas des régions viticoles au sens de
 * `WINE_REGIONS`, mais qui produisent et qu'on trouve donc en cave : un IGP
 * de montagne, un cidre breton, une bière du Nord, un pineau charentais.
 *
 * Elles vivent à part parce que `WINE_REGIONS` sert le select du champ
 * Région et doit rester la liste courte des grandes régions viticoles.
 * Ici, le seul critère est géographique : une zone de France
 * métropolitaine qu'on sait placer. Ce qui n'est pas métropolitain — un
 * rhum, un vin étranger — reste hors carte, par choix : le fond de carte
 * est la France, y poser un point n'aurait aucun sens.
 */
export const EXTRA_ZONE_COORDS: Readonly<Record<string, MapCoords>> = {
  'Hautes-Alpes': { lat: 44.57, lon: 6.1 },
  Bugey: { lat: 45.85, lon: 5.55 },
  Auvergne: { lat: 45.75, lon: 3.15 },
  Bretagne: { lat: 48.2, lon: -2.9 },
  Normandie: { lat: 49.05, lon: -0.15 },
  Lorraine: { lat: 48.75, lon: 6.1 },
  'Île-de-France': { lat: 48.85, lon: 2.35 },
  Nord: { lat: 50.6, lon: 3.1 },
  Charentes: { lat: 45.68, lon: -0.33 },
  Limousin: { lat: 45.65, lon: 1.35 },
};

/**
 * Index tolérants à la casse et aux accents, comme ceux de
 * `wineGeography` : la colonne `region` d'une bouteille ancienne n'est pas
 * forcément passée par `resolveWineGeography`. C'est aussi ce qui fait
 * tomber « Hautes Alpes » et « Hautes-Alpes » sur la même entrée.
 */
const REGION_INDEX = new Map(
  Object.entries({ ...REGION_COORDS, ...EXTRA_ZONE_COORDS }).map(([label, coords]) => [
    geographyKey(label),
    { label, coords },
  ]),
);

const SUB_REGION_INDEX = new Map(
  Object.entries(SUB_REGION_COORDS).map(([label, coords]) => [geographyKey(label), { label, coords }]),
);

/**
 * Lieu d'une bouteille sur la carte, au niveau de précision demandé.
 *
 * Même cascade que `resolveWineGeography`, du plus précis au plus large :
 * la sous-région si on la connaît et qu'on la demande, la région sinon.
 * `null` quand aucun des deux n'a de coordonnées — un vin étranger ou une
 * région hors table n'est pas posé « à peu près » quelque part, il est
 * signalé comme non localisé.
 *
 * L'appellation n'entre pas dans la table : elle a déjà déterminé la
 * sous-région à l'écriture (voir `resolveWineGeography`), et géocoder
 * plusieurs centaines d'AOC communales serait un autre chantier.
 */
export const resolveMapPlace = ({
  region,
  subRegion,
  precision,
}: ResolveMapPlaceArgs): Omit<MapPlace, 'bottles' | 'wines'> | null => {
  if (precision === 'subRegion' && subRegion) {
    const found = SUB_REGION_INDEX.get(geographyKey(subRegion));
    if (found) {
      const parent = region ? (REGION_INDEX.get(geographyKey(region))?.label ?? null) : null;
      return { key: `sub:${found.label}`, label: found.label, parentRegion: parent, coords: found.coords };
    }
  }

  if (region) {
    const found = REGION_INDEX.get(geographyKey(region));
    if (found) {
      return { key: `region:${found.label}`, label: found.label, parentRegion: null, coords: found.coords };
    }
  }

  return null;
};

/**
 * Bouteilles regroupées par lieu, du plus fourni au moins fourni, plus
 * celles qu'on ne sait pas placer.
 *
 * Le tri par nombre de bouteilles décroissant sert aussi au rendu : les
 * gros points sont dessinés en premier, donc sous les petits, faute de quoi
 * un Bourgogne à douze bouteilles avalerait le Jura voisin.
 */
export const buildMapPlaces = ({ bottles, precision }: BuildMapPlacesArgs): MapPlacesResult => {
  const byKey = new Map<string, MapPlace>();
  const unlocated: BottleForMap[] = [];

  for (const bottle of bottles) {
    const place = resolveMapPlace({ region: bottle.region, subRegion: bottle.subRegion, precision });
    if (!place) {
      unlocated.push(bottle);
      continue;
    }
    const existing = byKey.get(place.key);
    if (existing) {
      existing.wines.push(bottle);
      existing.bottles += bottle.quantity;
      continue;
    }
    byKey.set(place.key, { ...place, bottles: bottle.quantity, wines: [bottle] });
  }

  const places = Array.from(byKey.values()).sort((a, b) => {
    return b.bottles - a.bottles || a.label.localeCompare(b.label, 'fr');
  });

  return { places, unlocated };
};
