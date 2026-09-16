import { createHash, randomBytes } from 'node:crypto';

/** Token à usage unique (invitation, reset de mot de passe) — jamais devinable. */
export const generateToken = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Empreinte d'un jeton, telle qu'elle est stockée en base — le jeton
 * lui-même n'y entre jamais.
 *
 * Un jeton de réinitialisation vaut un mot de passe : qui le détient prend
 * la main sur le compte. Stocké en clair, une lecture de la base (fuite
 * d'une sauvegarde, accès au fichier SQLite) donnait donc le pouvoir de
 * réinitialiser n'importe quel compte ayant une demande en cours, et
 * d'accepter n'importe quelle invitation en attente. Stockée, l'empreinte
 * ne permet plus rien : seul le porteur du lien peut présenter la valeur
 * qui la produit.
 *
 * SHA-256 sans sel ni étirement, contrairement aux mots de passe : ces
 * jetons sont déjà 32 octets tirés au hasard, donc hors de portée d'une
 * attaque par dictionnaire ou par force brute — ce contre quoi bcrypt
 * protège. Un hachage rapide est ici exactement ce qu'il faut, et garde
 * la vérification à coût négligeable.
 */
export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};
