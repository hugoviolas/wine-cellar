import type { CellarRole } from './access';

/** Inviter/retirer un membre, changer un rôle, réglages de la cave. */
export const canManageCellar = (role: CellarRole): boolean => {
  return role === 'owner' || role === 'super_admin';
};

/** Créer/modifier/déplacer/supprimer une clayette ou une bouteille. */
export const canEditCellarContent = (role: CellarRole): boolean => {
  return role === 'owner' || role === 'editor' || role === 'super_admin';
};
