import { describe, it, expect } from 'vitest';
import {
  parseBottleDetails,
  getGrapeVarieties,
  getAppellation,
  getClassification,
  detailsSchemaByCategory,
} from './bottleCategories';

describe('parseBottleDetails', () => {
  it('valide des détails de vin corrects', () => {
    const result = parseBottleDetails('wine', {
      grapeVarieties: ['Merlot', 'Cabernet Franc'],
      appellation: 'Saint-Émilion',
    });
    expect(result.grapeVarieties).toEqual(['Merlot', 'Cabernet Franc']);
  });

  it('applique une valeur par défaut pour les champs optionnels manquants', () => {
    const result = parseBottleDetails('wine', {});
    expect(result.grapeVarieties).toEqual([]);
  });

  it('lit le classement d’un vin', () => {
    const result = parseBottleDetails('wine', { classification: 'Grand Cru Classé' });
    expect(result.classification).toBe('Grand Cru Classé');
  });

  it('valide des détails d’effervescent corrects', () => {
    const result = parseBottleDetails('sparkling', {
      grapeVarieties: ['Chardonnay', 'Pinot Noir'],
    });
    expect(result.grapeVarieties).toEqual(['Chardonnay', 'Pinot Noir']);
  });

  it.each(['cider', 'beer', 'spirit'] as const)(
    'accepte un objet vide pour la catégorie %s, qui n’a aucun champ spécifique',
    (category) => {
      expect(parseBottleDetails(category, {})).toEqual({});
    },
  );

  it('ignore une clé inconnue plutôt que de la stocker', () => {
    expect(parseBottleDetails('beer', { ibu: 55 })).toEqual({});
  });
});

/**
 * Garde-fou : `details` est remplacé en entier à chaque édition (voir
 * lib/bottleDetails.ts). Une clé ajoutée à un schéma sans son champ de
 * saisie dans les quatre formulaires serait donc effacée à la première
 * modification. Ce test casse pour forcer à traiter les deux ensemble.
 */
describe('schémas de détails', () => {
  it('ne déclare que des clés qui ont un champ de saisie dans les formulaires', () => {
    const keysByCategory = Object.fromEntries(
      Object.entries(detailsSchemaByCategory).map(([category, schema]) => [
        category,
        Object.keys(schema.shape).sort(),
      ]),
    );
    expect(keysByCategory).toEqual({
      wine: ['appellation', 'classification', 'grapeVarieties'],
      sparkling: ['grapeVarieties'],
      cider: [],
      beer: [],
      spirit: [],
    });
  });
});

describe('getGrapeVarieties', () => {
  it('lit les cépages pour un vin', () => {
    expect(
      getGrapeVarieties({ category: 'wine', details: { grapeVarieties: ['Niellucciu', 'Syrah'] } }),
    ).toEqual(['Niellucciu', 'Syrah']);
  });

  it('lit les cépages pour un effervescent', () => {
    expect(getGrapeVarieties({ category: 'sparkling', details: { grapeVarieties: ['Chardonnay'] } })).toEqual(
      ['Chardonnay'],
    );
  });

  it('renvoie [] pour une catégorie sans cépages', () => {
    expect(getGrapeVarieties({ category: 'beer', details: {} })).toEqual([]);
  });
});

describe('getClassification', () => {
  it('lit le classement pour un vin', () => {
    expect(getClassification({ category: 'wine', details: { classification: 'Premier Cru' } })).toBe(
      'Premier Cru',
    );
  });

  it('renvoie null si absent', () => {
    expect(getClassification({ category: 'wine', details: {} })).toBeNull();
  });

  it('renvoie null pour une catégorie sans classement', () => {
    expect(getClassification({ category: 'spirit', details: {} })).toBeNull();
  });
});

describe('getAppellation', () => {
  it('lit l’appellation pour un vin', () => {
    expect(getAppellation({ category: 'wine', details: { appellation: 'Patrimonio' } })).toBe('Patrimonio');
  });

  it('renvoie null si absente', () => {
    expect(getAppellation({ category: 'wine', details: {} })).toBeNull();
  });

  it('renvoie null pour une catégorie sans appellation', () => {
    expect(getAppellation({ category: 'sparkling', details: { grapeVarieties: ['Chardonnay'] } })).toBeNull();
  });
});
