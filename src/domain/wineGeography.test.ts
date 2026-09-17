import { describe, it, expect } from 'vitest';
import {
  resolveWineGeography,
  subRegionsForRegion,
  geographyKey,
  WINE_REGIONS,
  SUB_REGIONS_BY_REGION,
} from './wineGeography';

describe('geographyKey', () => {
  it('ignore casse, accents et ponctuation', () => {
    expect(geographyKey('Saint-Émilion')).toBe(geographyKey('SAINT EMILION'));
    expect(geographyKey('Côte-Rôtie')).toBe(geographyKey('cote rotie'));
  });

  it('assimile l’abréviation St et Ste', () => {
    expect(geographyKey('St-Julien')).toBe(geographyKey('Saint-Julien'));
    expect(geographyKey('Ste-Croix-du-Mont')).toBe(geographyKey('Sainte-Croix-du-Mont'));
  });

  it('ne colle pas deux appellations distinctes sur la même clé', () => {
    expect(geographyKey('Pauillac')).not.toBe(geographyKey('Pomerol'));
  });
});

describe('resolveWineGeography', () => {
  it('rattrape le cas Gruaud : appellation communale, région trop fine', () => {
    expect(
      resolveWineGeography({ region: 'Haut-Médoc', subRegion: null, appellation: 'Saint-Julien' }),
    ).toEqual({ region: 'Bordeaux', subRegion: 'Haut-Médoc' });
  });

  it('promeut une sous-région saisie dans le champ région', () => {
    expect(resolveWineGeography({ region: 'Côte de Nuits', subRegion: null, appellation: null })).toEqual({
      region: 'Bourgogne',
      subRegion: 'Côte de Nuits',
    });
  });

  it('fait primer l’appellation sur une région contradictoire', () => {
    expect(resolveWineGeography({ region: 'Bourgogne', subRegion: null, appellation: 'Pomerol' })).toEqual({
      region: 'Bordeaux',
      subRegion: 'Libournais',
    });
  });

  it('accepte les variantes d’écriture d’une appellation', () => {
    expect(resolveWineGeography({ region: null, subRegion: null, appellation: 'st julien' })).toEqual({
      region: 'Bordeaux',
      subRegion: 'Haut-Médoc',
    });
  });

  it('canonicalise la casse et les accents d’une région connue', () => {
    expect(resolveWineGeography({ region: 'rhone', subRegion: null, appellation: null }).region).toBe(
      'Rhône',
    );
  });

  it('conserve une appellation régionale sans sous-région imposée', () => {
    expect(resolveWineGeography({ region: null, subRegion: null, appellation: 'Bordeaux' })).toEqual({
      region: 'Bordeaux',
      subRegion: null,
    });
  });

  it('garde la sous-région déjà saisie quand l’appellation n’en impose pas', () => {
    expect(
      resolveWineGeography({ region: null, subRegion: 'Médoc', appellation: 'Bordeaux Supérieur' }),
    ).toEqual({ region: 'Bordeaux', subRegion: 'Médoc' });
  });

  it('n’efface jamais une région hors table (vin étranger)', () => {
    expect(resolveWineGeography({ region: 'Toscane', subRegion: null, appellation: 'Chianti' })).toEqual({
      region: 'Toscane',
      subRegion: null,
    });
  });

  it('normalise les chaînes vides en null', () => {
    expect(resolveWineGeography({ region: '  ', subRegion: '', appellation: undefined })).toEqual({
      region: null,
      subRegion: null,
    });
  });

  it('est idempotent : réappliquer ne change plus rien', () => {
    const once = resolveWineGeography({ region: 'Haut-Médoc', subRegion: null, appellation: 'Saint-Julien' });
    const twice = resolveWineGeography({ ...once, appellation: 'Saint-Julien' });
    expect(twice).toEqual(once);
  });
});

describe('subRegionsForRegion', () => {
  it('propose les sous-régions de la région', () => {
    expect(subRegionsForRegion('Bordeaux')).toContain('Haut-Médoc');
  });

  it('tolère une écriture non canonique', () => {
    expect(subRegionsForRegion('bourgogne')).toContain('Mâconnais');
  });

  it('renvoie [] pour une région inconnue ou vide', () => {
    expect(subRegionsForRegion('Toscane')).toEqual([]);
    expect(subRegionsForRegion(null)).toEqual([]);
  });
});

describe('cohérence des tables', () => {
  it('ne déclare que des régions de WINE_REGIONS', () => {
    expect(Object.keys(SUB_REGIONS_BY_REGION).sort()).toEqual([...WINE_REGIONS].sort());
  });

  it('n’a pas deux sous-régions homonymes dans des régions différentes', () => {
    const all = Object.values(SUB_REGIONS_BY_REGION).flatMap((subRegions) => subRegions.map(geographyKey));
    expect(new Set(all).size).toBe(all.length);
  });

  it('ne déclare aucune sous-région qui soit aussi une région', () => {
    const regionKeys = new Set(WINE_REGIONS.map(geographyKey));
    const collisions = Object.values(SUB_REGIONS_BY_REGION)
      .flat()
      .filter((subRegion) => regionKeys.has(geographyKey(subRegion)));
    expect(collisions).toEqual([]);
  });
});
