import { describe, it, expect } from 'vitest';
import {
  AROMA_FAMILIES,
  HUE_SWATCHES,
  TASTING_STEPS,
  WINE_SHADES,
  criteriaForShade,
  criterionLabel,
  orderedFill,
} from './tasting';

const CRITERIA = TASTING_STEPS.flatMap((step) => step.criteria);

describe('le contenu du mémo', () => {
  it('garde les quatre étapes dans l’ordre de la dégustation', () => {
    expect(TASTING_STEPS.map((step) => step.label)).toEqual(['Regarder', 'Sentir', 'Goûter', 'Conclusion']);
  });

  it('donne une pastille à chaque nom de couleur', () => {
    const teintes = CRITERIA.filter((criterion) => criterion.hues).flatMap((criterion) => criterion.values);
    expect(teintes.length).toBeGreaterThan(0);
    const sansPastille = teintes.filter((teinte) => !(teinte in HUE_SWATCHES));
    expect(sansPastille).toEqual([]);
  });

  /**
   * Le mémo est là pour proposer des mots : une ligne sans valeurs
   * n'afficherait qu'un intitulé et du vide. Le rendu ne prévoit pas ce cas,
   * c'est ce test qui l'interdit.
   */
  it('donne des valeurs à chaque critère', () => {
    const vides = CRITERIA.filter((criterion) => criterion.values.length === 0);
    expect(vides.map((criterion) => criterion.label)).toEqual([]);
  });

  it('s’arrête à la qualité en conclusion', () => {
    const conclusion = TASTING_STEPS.find((step) => step.key === 'conclusion');
    expect(conclusion?.criteria.map((criterion) => criterion.label)).toEqual(['Qualité']);
  });

  it('ne rattache un critère qu’à une couleur déclarée', () => {
    const connues = new Set(WINE_SHADES.map((shade) => shade.key));
    const orphelins = CRITERIA.filter((criterion) => criterion.shade && !connues.has(criterion.shade));
    expect(orphelins).toEqual([]);
  });

  it('couvre les trois couleurs pour chaque famille d’arômes', () => {
    for (const family of AROMA_FAMILIES) {
      for (const shade of WINE_SHADES) {
        expect(family.examples).toHaveProperty(shade.key);
      }
    }
  });

  it('assume l’absence d’« autres arômes » en rosé plutôt que de l’inventer', () => {
    const autres = AROMA_FAMILIES.find((family) => family.family === 'Autres arômes');
    expect(autres?.examples.rose).toBeNull();
    expect(autres?.examples.blanc).toBeTruthy();
  });

  /** Une échelle non ordonnée se lirait comme une progression qui n'existe pas. */
  it('ne déclare ordonnés que les critères qui le sont', () => {
    const ordonnes = CRITERIA.filter((criterion) => criterion.ordered).map((criterion) => criterion.label);
    expect(ordonnes).toEqual([
      'Intensité',
      'Intensité',
      'Saveur sucrée',
      'Saveur acide',
      'Sensation tannique',
      'Consistance',
      'Persistance aromatique',
      'Qualité',
    ]);
    const aromes = CRITERIA.filter((criterion) => criterion.label.startsWith('Arômes'));
    expect(aromes).toHaveLength(2);
    expect(aromes.every((criterion) => !criterion.ordered)).toBe(true);
  });
});

describe('criteriaForShade', () => {
  const regarder = TASTING_STEPS[0];

  it('montre les trois lignes de couleur quand aucun vin n’est choisi', () => {
    const criteria = criteriaForShade({ step: regarder!, shade: null });
    expect(criteria).toHaveLength(4);
  });

  it('ne garde que la ligne de couleur du vin choisi', () => {
    const criteria = criteriaForShade({ step: regarder!, shade: 'rouge' });
    expect(criteria.map((criterion) => criterion.label)).toEqual(['Intensité', 'Couleur']);
    expect(criteria[1]?.values).toContain('Grenat');
  });

  /**
   * Les tanins sur un blanc, l'acidité sur un rouge : la réglette ne les
   * sépare pas, nous non plus. Filtrer plus serait interpréter.
   */
  it('laisse intacts les critères que le mémo ne sépare pas par couleur', () => {
    const gouter = TASTING_STEPS.find((step) => step.key === 'gouter');
    expect(criteriaForShade({ step: gouter!, shade: 'blanc' })).toEqual(gouter?.criteria);
  });
});

describe('criterionLabel', () => {
  const couleurRouge = TASTING_STEPS[0]?.criteria.find((criterion) => criterion.shade === 'rouge');
  const intensite = TASTING_STEPS[0]?.criteria[0];

  it('précise de quelle couleur il s’agit quand les trois lignes se suivent', () => {
    expect(criterionLabel({ criterion: couleurRouge!, shade: null })).toBe('Couleur — Rouge');
  });

  it('s’en tient à l’intitulé quand une seule ligne reste', () => {
    expect(criterionLabel({ criterion: couleurRouge!, shade: 'rouge' })).toBe('Couleur');
  });

  it('ne touche pas aux critères communs à toutes les couleurs', () => {
    expect(criterionLabel({ criterion: intensite!, shade: null })).toBe('Intensité');
    expect(criterionLabel({ criterion: intensite!, shade: 'blanc' })).toBe('Intensité');
  });
});

describe('orderedFill', () => {
  it('va du plus clair au plus soutenu', () => {
    expect(orderedFill({ index: 0, count: 5 })).toBe('#f1ede2');
    expect(orderedFill({ index: 4, count: 5 })).toBe('#dcc486');
  });

  it('fonce à chaque cran, sans jamais reculer', () => {
    const luminance = (color: string): number => {
      return (
        parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16) + parseInt(color.slice(5, 7), 16)
      );
    };
    for (const count of [2, 3, 4, 5]) {
      const teintes = Array.from({ length: count }, (_, index) => orderedFill({ index, count }));
      for (let i = 1; i < teintes.length; i += 1) {
        expect(luminance(teintes[i] as string)).toBeLessThan(luminance(teintes[i - 1] as string));
      }
    }
  });

  it('reste au plus clair pour une valeur unique, sans diviser par zéro', () => {
    expect(orderedFill({ index: 0, count: 1 })).toBe('#f1ede2');
  });

  it('produit toujours un hexadécimal à six chiffres', () => {
    for (let index = 0; index < 5; index += 1) {
      expect(orderedFill({ index, count: 5 })).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
