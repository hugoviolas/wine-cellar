import { describe, it, expect } from 'vitest';
import { buildBottleDetails } from './bottleDetails';
import { parseBottleDetails } from '@/domain/bottleCategories';

const emptyFields = { grapeVarieties: '', appellation: '', classification: '' };

describe('buildBottleDetails', () => {
  it('découpe les cépages et ignore les entrées vides', () => {
    const details = buildBottleDetails({
      ...emptyFields,
      category: 'wine',
      grapeVarieties: 'Merlot, , Syrah ',
    });
    expect(details).toEqual({
      grapeVarieties: ['Merlot', 'Syrah'],
      appellation: undefined,
      classification: undefined,
    });
  });

  it('renvoie appellation et classement pour un vin', () => {
    const details = buildBottleDetails({
      category: 'wine',
      grapeVarieties: '',
      appellation: ' Patrimonio ',
      classification: 'Grand Cru Classé',
    });
    expect(details).toEqual({
      grapeVarieties: [],
      appellation: 'Patrimonio',
      classification: 'Grand Cru Classé',
    });
  });

  it('n’expose que les cépages pour un effervescent', () => {
    const details = buildBottleDetails({
      category: 'sparkling',
      grapeVarieties: 'Chardonnay',
      appellation: 'ignorée',
      classification: 'ignoré',
    });
    expect(details).toEqual({ grapeVarieties: ['Chardonnay'] });
  });

  it.each(['cider', 'beer', 'spirit'])('renvoie un objet vide pour la catégorie %s', (category) => {
    expect(buildBottleDetails({ ...emptyFields, category })).toEqual({});
  });

  // Le contrat qui compte : ce que le formulaire produit doit traverser la
  // validation du domaine sans perte, pour les cinq catégories.
  it.each(['wine', 'sparkling', 'cider', 'beer', 'spirit'] as const)(
    'produit des détails valides pour la catégorie %s',
    (category) => {
      const details = buildBottleDetails({
        category,
        grapeVarieties: 'Syrah',
        appellation: 'Patrimonio',
        classification: 'Cru Classé',
      });
      expect(() => parseBottleDetails(category, details)).not.toThrow();
    },
  );
});
