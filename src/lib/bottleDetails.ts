import type { BuildBottleDetailsArgs } from './interfaces/build-bottle-details-args.interface';

/** `"Merlot, , Syrah"` -> `['Merlot', 'Syrah']`. */
const splitList = (raw: string): string[] => {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

/**
 * Détails JSON d'une bouteille (ou d'un item de wishlist), construits depuis
 * les champs bruts d'un formulaire.
 *
 * Point de vérité unique des quatre formulaires (ajout/édition × bouteille/
 * wishlist), qui en avaient chacun leur copie — et pas le même contrat :
 * l'ajout renvoyait `{}` là où l'édition renvoyait `undefined` pour les
 * catégories sans champ spécifique.
 *
 * L'objet renvoyé est **complet pour sa catégorie** : il remplace celui qui
 * est stocké, il ne le complète pas. C'est ce qui permet de vider un champ
 * en l'effaçant dans le formulaire, et c'est ce qui impose la règle posée
 * dans domain/bottleCategories.ts — toute clé d'un schéma de détails a son
 * champ de saisie ici, sans quoi une édition l'effacerait.
 */
export const buildBottleDetails = ({
  category,
  grapeVarieties,
  appellation,
  classification,
}: BuildBottleDetailsArgs): Record<string, unknown> => {
  if (category === 'wine') {
    return {
      grapeVarieties: splitList(grapeVarieties),
      appellation: appellation.trim() || undefined,
      classification: classification.trim() || undefined,
    };
  }
  if (category === 'sparkling') {
    return { grapeVarieties: splitList(grapeVarieties) };
  }
  return {};
};
