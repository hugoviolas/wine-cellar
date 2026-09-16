/**
 * Bornes de longueur des champs libres.
 *
 * Aucun champ texte n'en avait, à deux exceptions près : la base est un
 * fichier SQLite sur le Raspberry Pi, les route handlers de l'App Router
 * n'imposent aucune taille maximale de corps de requête, et l'inscription
 * est ouverte. N'importe qui pouvait donc créer un compte et pousser des
 * notes de plusieurs centaines de mégaoctets jusqu'à saturer le disque que
 * la base partage avec le reste du système.
 *
 * Les valeurs sont volontairement larges : il s'agit d'écarter l'absurde,
 * pas de contraindre un usage réel. Un nom de vin qui dépasse 200
 * caractères n'est pas un nom de vin.
 */
export const FIELD_MAX = {
  /** Nom, producteur, région, couleur, appellation, cépage… */
  shortText: 200,
  /** Note personnelle, commentaire de dégustation, notes sur la cave. */
  longText: 2000,
  /** Adresse email : la longueur maximale d'une adresse selon la RFC 5321. */
  email: 254,
  /**
   * Mot de passe. bcrypt ne prend de toute façon en compte que les 72
   * premiers octets — au-delà, la longueur n'ajoute aucune sécurité et
   * ne fait que transporter des données.
   */
  password: 200,
  /** Entrées d'une liste libre : cépages, variétés de pommes. */
  listItems: 30,
} as const;
