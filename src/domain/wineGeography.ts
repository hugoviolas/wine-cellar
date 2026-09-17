import type { ResolveWineGeographyArgs } from './interfaces/resolve-wine-geography-args.interface';
import type { WineGeography } from './interfaces/wine-geography.interface';

/**
 * Régions viticoles françaises courantes, pour le select du champ "Région".
 * Liste volontairement non exhaustive — une valeur hors liste reste
 * acceptée telle quelle (AOC non listée, vin étranger...).
 */
export const WINE_REGIONS = [
  'Alsace',
  'Beaujolais',
  'Bordeaux',
  'Bourgogne',
  'Champagne',
  'Corse',
  'Jura',
  'Languedoc-Roussillon',
  'Loire',
  'Provence',
  'Rhône',
  'Savoie',
  'Sud-Ouest',
] as const;

export type WineRegion = (typeof WINE_REGIONS)[number];

/**
 * Sous-régions connues, par région. Niveau intermédiaire entre la région et
 * l'appellation : le Haut-Médoc n'est pas une région au sens de ce select,
 * et Saint-Julien n'est pas une sous-région — c'est une AOC communale située
 * dans le Haut-Médoc.
 */
export const SUB_REGIONS_BY_REGION: Readonly<Record<WineRegion, readonly string[]>> = {
  Alsace: ['Bas-Rhin', 'Haut-Rhin'],
  Beaujolais: ['Crus du Beaujolais'],
  Bordeaux: ['Médoc', 'Haut-Médoc', 'Graves', 'Sauternais', 'Libournais', 'Blaye-Bourg', 'Entre-deux-Mers'],
  Bourgogne: ['Chablis', 'Côte de Nuits', 'Côte de Beaune', 'Côte Chalonnaise', 'Mâconnais'],
  Champagne: ['Montagne de Reims', 'Côte des Blancs', 'Vallée de la Marne', 'Côte des Bar'],
  Corse: [],
  Jura: [],
  'Languedoc-Roussillon': ['Languedoc', 'Roussillon'],
  Loire: ['Pays nantais', 'Anjou-Saumur', 'Touraine', 'Centre-Loire'],
  Provence: [],
  Rhône: ['Rhône septentrional', 'Rhône méridional'],
  Savoie: [],
  'Sud-Ouest': ['Bergeracois', 'Quercy', 'Gascogne'],
};

interface AppellationEntry {
  readonly region: WineRegion;
  /** `null` quand aucune sous-région ne s'impose (appellation régionale, ou découpage non pertinent). */
  readonly subRegion: string | null;
}

/**
 * Appellations connues et leur rattachement. Sert à trancher : une AOC est
 * l'information la plus précise d'une étiquette, donc la plus fiable pour
 * en déduire le reste.
 *
 * Volontairement partielle — quelques centaines d'AOC existent, et une
 * entrée fausse coûte plus cher qu'une entrée manquante. Une appellation
 * absente d'ici ne casse rien : la valeur saisie est conservée telle quelle.
 */
const APPELLATIONS: Readonly<Record<string, AppellationEntry>> = {
  // — Bordeaux —
  Bordeaux: { region: 'Bordeaux', subRegion: null },
  'Bordeaux Supérieur': { region: 'Bordeaux', subRegion: null },
  Médoc: { region: 'Bordeaux', subRegion: 'Médoc' },
  'Haut-Médoc': { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  'Saint-Estèphe': { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  Pauillac: { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  'Saint-Julien': { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  Margaux: { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  'Listrac-Médoc': { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  'Moulis-en-Médoc': { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
  Graves: { region: 'Bordeaux', subRegion: 'Graves' },
  'Pessac-Léognan': { region: 'Bordeaux', subRegion: 'Graves' },
  Sauternes: { region: 'Bordeaux', subRegion: 'Sauternais' },
  Barsac: { region: 'Bordeaux', subRegion: 'Sauternais' },
  'Saint-Émilion': { region: 'Bordeaux', subRegion: 'Libournais' },
  'Saint-Émilion Grand Cru': { region: 'Bordeaux', subRegion: 'Libournais' },
  Pomerol: { region: 'Bordeaux', subRegion: 'Libournais' },
  'Lalande-de-Pomerol': { region: 'Bordeaux', subRegion: 'Libournais' },
  Fronsac: { region: 'Bordeaux', subRegion: 'Libournais' },
  'Canon-Fronsac': { region: 'Bordeaux', subRegion: 'Libournais' },
  'Montagne-Saint-Émilion': { region: 'Bordeaux', subRegion: 'Libournais' },
  'Lussac-Saint-Émilion': { region: 'Bordeaux', subRegion: 'Libournais' },
  'Puisseguin-Saint-Émilion': { region: 'Bordeaux', subRegion: 'Libournais' },
  'Castillon Côtes de Bordeaux': { region: 'Bordeaux', subRegion: 'Libournais' },
  Blaye: { region: 'Bordeaux', subRegion: 'Blaye-Bourg' },
  'Côtes de Bourg': { region: 'Bordeaux', subRegion: 'Blaye-Bourg' },
  'Entre-deux-Mers': { region: 'Bordeaux', subRegion: 'Entre-deux-Mers' },
  Cadillac: { region: 'Bordeaux', subRegion: 'Entre-deux-Mers' },
  Loupiac: { region: 'Bordeaux', subRegion: 'Entre-deux-Mers' },
  'Sainte-Croix-du-Mont': { region: 'Bordeaux', subRegion: 'Entre-deux-Mers' },

  // — Bourgogne —
  Bourgogne: { region: 'Bourgogne', subRegion: null },
  Chablis: { region: 'Bourgogne', subRegion: 'Chablis' },
  'Petit Chablis': { region: 'Bourgogne', subRegion: 'Chablis' },
  'Chablis Grand Cru': { region: 'Bourgogne', subRegion: 'Chablis' },
  Irancy: { region: 'Bourgogne', subRegion: 'Chablis' },
  Marsannay: { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  Fixin: { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  'Gevrey-Chambertin': { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  'Morey-Saint-Denis': { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  'Chambolle-Musigny': { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  Vougeot: { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  'Clos de Vougeot': { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  'Vosne-Romanée': { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  Échezeaux: { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  'Nuits-Saint-Georges': { region: 'Bourgogne', subRegion: 'Côte de Nuits' },
  Ladoix: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Aloxe-Corton': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Corton: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Corton-Charlemagne': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Pernand-Vergelesses': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Savigny-lès-Beaune': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Beaune: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Pommard: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Volnay: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Monthelie: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Auxey-Duresses': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Meursault: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Saint-Aubin': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Puligny-Montrachet': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  'Chassagne-Montrachet': { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Montrachet: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Santenay: { region: 'Bourgogne', subRegion: 'Côte de Beaune' },
  Bouzeron: { region: 'Bourgogne', subRegion: 'Côte Chalonnaise' },
  Rully: { region: 'Bourgogne', subRegion: 'Côte Chalonnaise' },
  Mercurey: { region: 'Bourgogne', subRegion: 'Côte Chalonnaise' },
  Givry: { region: 'Bourgogne', subRegion: 'Côte Chalonnaise' },
  Montagny: { region: 'Bourgogne', subRegion: 'Côte Chalonnaise' },
  Mâcon: { region: 'Bourgogne', subRegion: 'Mâconnais' },
  'Viré-Clessé': { region: 'Bourgogne', subRegion: 'Mâconnais' },
  'Pouilly-Fuissé': { region: 'Bourgogne', subRegion: 'Mâconnais' },
  'Saint-Véran': { region: 'Bourgogne', subRegion: 'Mâconnais' },

  // — Beaujolais —
  Beaujolais: { region: 'Beaujolais', subRegion: null },
  'Beaujolais-Villages': { region: 'Beaujolais', subRegion: null },
  Brouilly: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  'Côte de Brouilly': { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  Chénas: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  Chiroubles: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  Fleurie: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  Juliénas: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  Morgon: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  'Moulin-à-Vent': { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  Régnié: { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },
  'Saint-Amour': { region: 'Beaujolais', subRegion: 'Crus du Beaujolais' },

  // — Rhône —
  'Côtes du Rhône': { region: 'Rhône', subRegion: null },
  'Côtes du Rhône Villages': { region: 'Rhône', subRegion: null },
  'Côte-Rôtie': { region: 'Rhône', subRegion: 'Rhône septentrional' },
  Condrieu: { region: 'Rhône', subRegion: 'Rhône septentrional' },
  'Château-Grillet': { region: 'Rhône', subRegion: 'Rhône septentrional' },
  'Saint-Joseph': { region: 'Rhône', subRegion: 'Rhône septentrional' },
  'Crozes-Hermitage': { region: 'Rhône', subRegion: 'Rhône septentrional' },
  Hermitage: { region: 'Rhône', subRegion: 'Rhône septentrional' },
  Cornas: { region: 'Rhône', subRegion: 'Rhône septentrional' },
  'Saint-Péray': { region: 'Rhône', subRegion: 'Rhône septentrional' },
  'Châteauneuf-du-Pape': { region: 'Rhône', subRegion: 'Rhône méridional' },
  Gigondas: { region: 'Rhône', subRegion: 'Rhône méridional' },
  Vacqueyras: { region: 'Rhône', subRegion: 'Rhône méridional' },
  Rasteau: { region: 'Rhône', subRegion: 'Rhône méridional' },
  Cairanne: { region: 'Rhône', subRegion: 'Rhône méridional' },
  Vinsobres: { region: 'Rhône', subRegion: 'Rhône méridional' },
  Lirac: { region: 'Rhône', subRegion: 'Rhône méridional' },
  Tavel: { region: 'Rhône', subRegion: 'Rhône méridional' },
  'Beaumes-de-Venise': { region: 'Rhône', subRegion: 'Rhône méridional' },

  // — Loire —
  Muscadet: { region: 'Loire', subRegion: 'Pays nantais' },
  'Muscadet Sèvre-et-Maine': { region: 'Loire', subRegion: 'Pays nantais' },
  Anjou: { region: 'Loire', subRegion: 'Anjou-Saumur' },
  Savennières: { region: 'Loire', subRegion: 'Anjou-Saumur' },
  'Coteaux du Layon': { region: 'Loire', subRegion: 'Anjou-Saumur' },
  Bonnezeaux: { region: 'Loire', subRegion: 'Anjou-Saumur' },
  'Quarts-de-Chaume': { region: 'Loire', subRegion: 'Anjou-Saumur' },
  Saumur: { region: 'Loire', subRegion: 'Anjou-Saumur' },
  'Saumur-Champigny': { region: 'Loire', subRegion: 'Anjou-Saumur' },
  Touraine: { region: 'Loire', subRegion: 'Touraine' },
  Vouvray: { region: 'Loire', subRegion: 'Touraine' },
  'Montlouis-sur-Loire': { region: 'Loire', subRegion: 'Touraine' },
  Chinon: { region: 'Loire', subRegion: 'Touraine' },
  Bourgueil: { region: 'Loire', subRegion: 'Touraine' },
  'Saint-Nicolas-de-Bourgueil': { region: 'Loire', subRegion: 'Touraine' },
  Sancerre: { region: 'Loire', subRegion: 'Centre-Loire' },
  'Pouilly-Fumé': { region: 'Loire', subRegion: 'Centre-Loire' },
  'Menetou-Salon': { region: 'Loire', subRegion: 'Centre-Loire' },
  Quincy: { region: 'Loire', subRegion: 'Centre-Loire' },
  Reuilly: { region: 'Loire', subRegion: 'Centre-Loire' },

  // — Alsace / Champagne —
  Alsace: { region: 'Alsace', subRegion: null },
  'Alsace Grand Cru': { region: 'Alsace', subRegion: null },
  "Crémant d'Alsace": { region: 'Alsace', subRegion: null },
  Champagne: { region: 'Champagne', subRegion: null },
  'Coteaux Champenois': { region: 'Champagne', subRegion: null },

  // — Provence —
  'Côtes de Provence': { region: 'Provence', subRegion: null },
  Bandol: { region: 'Provence', subRegion: null },
  Cassis: { region: 'Provence', subRegion: null },
  Bellet: { region: 'Provence', subRegion: null },
  Palette: { region: 'Provence', subRegion: null },
  "Coteaux d'Aix-en-Provence": { region: 'Provence', subRegion: null },
  'Coteaux Varois en Provence': { region: 'Provence', subRegion: null },
  'Les Baux-de-Provence': { region: 'Provence', subRegion: null },

  // — Languedoc-Roussillon —
  Languedoc: { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  Corbières: { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  Minervois: { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  Faugères: { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  'Saint-Chinian': { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  Fitou: { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  'Pic Saint-Loup': { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  'Picpoul de Pinet': { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  'Terrasses du Larzac': { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  'La Clape': { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  Limoux: { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  'Blanquette de Limoux': { region: 'Languedoc-Roussillon', subRegion: 'Languedoc' },
  Collioure: { region: 'Languedoc-Roussillon', subRegion: 'Roussillon' },
  Banyuls: { region: 'Languedoc-Roussillon', subRegion: 'Roussillon' },
  Maury: { region: 'Languedoc-Roussillon', subRegion: 'Roussillon' },
  Rivesaltes: { region: 'Languedoc-Roussillon', subRegion: 'Roussillon' },
  'Côtes du Roussillon': { region: 'Languedoc-Roussillon', subRegion: 'Roussillon' },
  'Côtes du Roussillon Villages': { region: 'Languedoc-Roussillon', subRegion: 'Roussillon' },

  // — Sud-Ouest —
  Cahors: { region: 'Sud-Ouest', subRegion: 'Quercy' },
  Fronton: { region: 'Sud-Ouest', subRegion: 'Quercy' },
  Bergerac: { region: 'Sud-Ouest', subRegion: 'Bergeracois' },
  Monbazillac: { region: 'Sud-Ouest', subRegion: 'Bergeracois' },
  Pécharmant: { region: 'Sud-Ouest', subRegion: 'Bergeracois' },
  'Côtes de Duras': { region: 'Sud-Ouest', subRegion: 'Bergeracois' },
  Madiran: { region: 'Sud-Ouest', subRegion: 'Gascogne' },
  'Pacherenc du Vic-Bilh': { region: 'Sud-Ouest', subRegion: 'Gascogne' },
  Jurançon: { region: 'Sud-Ouest', subRegion: 'Gascogne' },
  'Saint-Mont': { region: 'Sud-Ouest', subRegion: 'Gascogne' },
  Irouléguy: { region: 'Sud-Ouest', subRegion: null },
  Gaillac: { region: 'Sud-Ouest', subRegion: null },
  Marcillac: { region: 'Sud-Ouest', subRegion: null },
  Buzet: { region: 'Sud-Ouest', subRegion: null },

  // — Jura / Savoie / Corse —
  Arbois: { region: 'Jura', subRegion: null },
  'Château-Chalon': { region: 'Jura', subRegion: null },
  "L'Étoile": { region: 'Jura', subRegion: null },
  'Côtes du Jura': { region: 'Jura', subRegion: null },
  'Crémant du Jura': { region: 'Jura', subRegion: null },
  'Vin de Savoie': { region: 'Savoie', subRegion: null },
  'Roussette de Savoie': { region: 'Savoie', subRegion: null },
  Seyssel: { region: 'Savoie', subRegion: null },
  Patrimonio: { region: 'Corse', subRegion: null },
  Ajaccio: { region: 'Corse', subRegion: null },
  'Vin de Corse': { region: 'Corse', subRegion: null },
  'Muscat du Cap Corse': { region: 'Corse', subRegion: null },
};

/**
 * Clé de comparaison insensible à la casse, aux accents, à la ponctuation et
 * à l'abréviation « St ». « St-Julien », « Saint Julien » et « SAINT-JULIEN »
 * tombent tous sur `saintjulien` — sans quoi la moitié des saisies réelles
 * raterait la table.
 */
export const geographyKey = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bste\b/g, 'sainte')
    .replace(/\bst\b/g, 'saint')
    .replace(/[^a-z0-9]+/g, '');
};

/** Index construit une fois au chargement, pour ne pas reparcourir les tables à chaque appel. */
const buildIndex = <T>(entries: ReadonlyArray<readonly [string, T]>): ReadonlyMap<string, T> => {
  return new Map(entries.map(([label, value]) => [geographyKey(label), value]));
};

const APPELLATION_INDEX = buildIndex(Object.entries(APPELLATIONS));

const REGION_INDEX = buildIndex(WINE_REGIONS.map((region) => [region, region] as const));

const SUB_REGION_INDEX = buildIndex(
  Object.entries(SUB_REGIONS_BY_REGION).flatMap(([region, subRegions]) =>
    subRegions.map((subRegion) => [subRegion, { region: region as WineRegion, subRegion }] as const),
  ),
);

const trimmedOrNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Région et sous-région canoniques d'une bouteille.
 *
 * Trois règles, appliquées dans cet ordre :
 *
 * 1. **L'appellation fait autorité.** C'est l'information la plus précise
 *    d'une étiquette : si elle est connue, elle détermine la région et la
 *    sous-région, même si une autre région avait été saisie. C'est ce qui
 *    rattrape un « Saint-Julien » rangé en région « Haut-Médoc ».
 * 2. **Une sous-région saisie comme région est promue.** « Haut-Médoc » dans
 *    le champ Région devient région « Bordeaux », sous-région « Haut-Médoc ».
 * 3. **Sinon, on canonicalise ce qu'on reconnaît et on garde le reste.** Une
 *    région ou une sous-région hors table n'est jamais effacée : la liste est
 *    française et non exhaustive, un vin étranger doit pouvoir exister.
 */
export const resolveWineGeography = ({
  region,
  subRegion,
  appellation,
}: ResolveWineGeographyArgs): WineGeography => {
  const rawRegion = trimmedOrNull(region);
  const rawSubRegion = trimmedOrNull(subRegion);
  const rawAppellation = trimmedOrNull(appellation);

  if (rawAppellation) {
    const known = APPELLATION_INDEX.get(geographyKey(rawAppellation));
    if (known) {
      return { region: known.region, subRegion: known.subRegion ?? rawSubRegion };
    }
  }

  if (rawRegion) {
    const promoted = SUB_REGION_INDEX.get(geographyKey(rawRegion));
    if (promoted) {
      return { region: promoted.region, subRegion: promoted.subRegion };
    }
  }

  const canonicalRegion = rawRegion ? (REGION_INDEX.get(geographyKey(rawRegion)) ?? rawRegion) : null;
  const canonicalSubRegion = rawSubRegion
    ? (SUB_REGION_INDEX.get(geographyKey(rawSubRegion))?.subRegion ?? rawSubRegion)
    : null;

  return { region: canonicalRegion, subRegion: canonicalSubRegion };
};

/** Sous-régions proposables pour une région donnée — [] si la région est inconnue ou n'en a pas. */
export const subRegionsForRegion = (region: string | null): readonly string[] => {
  if (!region) {
    return [];
  }
  const canonical = REGION_INDEX.get(geographyKey(region));
  return canonical ? SUB_REGIONS_BY_REGION[canonical] : [];
};
