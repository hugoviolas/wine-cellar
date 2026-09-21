import type { WineShade } from './interfaces/wine-shade.type';
import type { WineShadeOption } from './interfaces/wine-shade-option.interface';
import type { TastingCriterion } from './interfaces/tasting-criterion.interface';
import type { TastingStep } from './interfaces/tasting-step.interface';
import type { AromaFamily } from './interfaces/aroma-family.interface';

export type { WineShade, WineShadeOption, TastingCriterion, TastingStep, AromaFamily };

/**
 * Le mémo de dégustation : quatre étapes, leurs critères, et les exemples
 * d'arômes par couleur de vin.
 *
 * C'est une table de référence, recopiée telle quelle depuis une réglette de
 * dégustation — orthographe comprise, « Epicé » sans accent. Rien ici n'est
 * calculé ni deviné : si une valeur manque, c'est qu'elle manque à la
 * source. Ne rien y ajouter sans savoir d'où ça vient.
 */

export const WINE_SHADES: readonly WineShadeOption[] = [
  { key: 'blanc', label: 'Blanc', plural: 'Vins blancs', dot: '#e9dd94' },
  { key: 'rose', label: 'Rosé', plural: 'Vins rosés', dot: '#f0b48f' },
  { key: 'rouge', label: 'Rouge', plural: 'Vins rouges', dot: '#8e1f2f' },
];

/**
 * Teinte approchée de chaque nom de couleur de l'étape « Regarder ».
 *
 * « Grenat » ou « Acajou » ne disent rien tant qu'on ne les a pas vus : la
 * pastille sert de repère à l'œil, le mot reste celui du mémo. Ces valeurs
 * sont indicatives, pas une norme.
 */
export const HUE_SWATCHES: Readonly<Record<string, string>> = {
  'Jaune pâle': '#f1eec6',
  'Jaune paille': '#e7d891',
  'Jaune or': '#dcbc52',
  'Rose pâle': '#f4ced5',
  'Rose orangé': '#f0b48f',
  Violet: '#6a2149',
  Rubis: '#9c1b2f',
  Grenat: '#6d1420',
  Acajou: '#6b3324',
};

export const TASTING_STEPS: readonly TastingStep[] = [
  {
    key: 'regarder',
    label: 'Regarder',
    criteria: [
      { label: 'Intensité', values: ['Faible', 'Moyenne', 'Soutenue'], ordered: true },
      {
        label: 'Couleur',
        values: ['Jaune pâle', 'Jaune paille', 'Jaune or'],
        hues: true,
        shade: 'blanc',
      },
      { label: 'Couleur', values: ['Rose pâle', 'Rose orangé'], hues: true, shade: 'rose' },
      {
        label: 'Couleur',
        values: ['Violet', 'Rubis', 'Grenat', 'Acajou'],
        hues: true,
        shade: 'rouge',
      },
    ],
  },
  {
    key: 'sentir',
    label: 'Sentir',
    criteria: [
      { label: 'Intensité', values: ['Faible', 'Moyenne', 'Puissante'], ordered: true },
      { label: 'Arômes', values: ['Fruité', 'Floral', 'Végétal', 'Epicé', 'Autres'] },
    ],
  },
  {
    key: 'gouter',
    label: 'Goûter',
    criteria: [
      { label: 'Saveur sucrée', values: ['Aucune', 'Légère', 'Moyenne', 'Prononcée'], ordered: true },
      { label: 'Saveur acide', values: ['Faible', 'Moyenne', 'Puissante'], ordered: true },
      { label: 'Sensation tannique', values: ['Légère', 'Moyenne', 'Prononcée'], ordered: true },
      { label: 'Consistance', values: ['Légère', 'Moyenne', 'Puissante'], ordered: true },
      { label: 'Arômes en bouche', values: ['Fruité', 'Floral', 'Végétal', 'Epicé', 'Autres'] },
      { label: 'Persistance aromatique', values: ['Courte', 'Moyenne', 'Longue'], ordered: true },
    ],
  },
  {
    key: 'conclusion',
    label: 'Conclusion',
    criteria: [
      {
        label: 'Qualité',
        values: ['Faible', 'Satisfaisante', 'Bonne', 'Très bonne', 'Excellente'],
        ordered: true,
      },
    ],
  },
];

export const AROMA_FAMILIES: readonly AromaFamily[] = [
  {
    family: 'Fruité',
    examples: {
      blanc:
        'Citron, pamplemousse, orange, ananas, litchi, melon, muscat, pomme, poire, abricot, pêche, amande, noix',
      rose: 'Cerise, groseille, fraise, framboise, pamplemousse, pomme, amande',
      rouge: 'Fraise, framboise, groseille, cassis, myrtille, mûre, cerise, pruneau',
    },
  },
  {
    family: 'Floral',
    examples: {
      blanc: 'Aubépine, acacia, tilleul, miel, rose, violette, fleur d’oranger',
      rose: 'Rose, violette, fleurs séchées, fleur d’oranger',
      rouge: 'Rose, violette',
    },
  },
  {
    family: 'Végétal',
    examples: {
      blanc: 'Champignon, herbe fraîche, fougère, anis',
      rose: 'Poivron vert',
      rouge: 'Champignon, truffe, cèdre, pin, réglisse, terre, poivron vert',
    },
  },
  {
    family: 'Epicé',
    examples: {
      blanc: 'Vanille, cannelle, clou de girofle, safran',
      rose: 'Poivre',
      rouge: 'Vanille, cannelle, clou de girofle, poivre',
    },
  },
  {
    family: 'Autres arômes',
    examples: {
      blanc: 'Beurre, pain grillé, amande grillée, noisette grillée, café, caramel, note fumée',
      // La réglette ne donne rien pour le rosé : on l'affiche comme tel.
      rose: null,
      rouge: 'Cuir, café, caramel, chocolat noir, note fumée',
    },
  },
];

/**
 * Critères à afficher pour la couleur de vin choisie.
 *
 * Seules les lignes que le mémo sépare lui-même par couleur sont filtrées —
 * les trois « Couleur » de l'étape « Regarder ». Masquer autre chose (les
 * tanins sur un blanc, par exemple) serait une interprétation, pas une
 * lecture.
 */
export const criteriaForShade = ({
  step,
  shade,
}: {
  step: TastingStep;
  shade: WineShade | null;
}): readonly TastingCriterion[] => {
  if (!shade) {
    return step.criteria;
  }
  return step.criteria.filter((criterion) => !criterion.shade || criterion.shade === shade);
};

/**
 * Intitulé d'un critère, tel qu'il doit se lire à l'écran.
 *
 * Trois lignes s'appellent « Couleur » — une par couleur de vin. Sans filtre,
 * elles se suivent et rien ne les distingue : on précise alors de laquelle il
 * s'agit. Un vin choisi, il n'en reste qu'une, et le rappel devient du bruit.
 */
export const criterionLabel = ({
  criterion,
  shade,
}: {
  criterion: TastingCriterion;
  shade: WineShade | null;
}): string => {
  if (shade || !criterion.shade) {
    return criterion.label;
  }
  const option = WINE_SHADES.find((item) => item.key === criterion.shade);
  return option ? `${criterion.label} — ${option.label}` : criterion.label;
};

/** Sable très clair puis or adouci : les deux bouts de l'échelle. */
const RAMP_FROM = { r: 0xf1, g: 0xed, b: 0xe2 };
const RAMP_TO = { r: 0xdc, g: 0xc4, b: 0x86 };

const hex = (value: number): string => Math.round(value).toString(16).padStart(2, '0');

/**
 * Fond d'une valeur d'échelle, du plus clair au plus soutenu.
 *
 * C'est tout ce qui distingue une échelle d'une liste : la teinte monte avec
 * la valeur, et rien d'autre n'apparaît à l'écran. Une graduation ou un axe
 * auraient la forme d'un contrôle, dans une page qui ne se manipule pas.
 */
export const orderedFill = ({ index, count }: { index: number; count: number }): string => {
  const ratio = count > 1 ? Math.min(1, Math.max(0, index / (count - 1))) : 0;
  const channel = (from: number, to: number): string => hex(from + (to - from) * ratio);
  return `#${channel(RAMP_FROM.r, RAMP_TO.r)}${channel(RAMP_FROM.g, RAMP_TO.g)}${channel(RAMP_FROM.b, RAMP_TO.b)}`;
};
