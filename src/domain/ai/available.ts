import { hasApiKeyConfigured } from '../supervision';
import { eq } from 'drizzle-orm';
import { cellarMemberships, cellars } from '../../db/schema';
import type { AiCellar } from './interfaces/ai-cellar.interface';
import type { IsAiAvailableForUserArgs } from './interfaces/is-ai-available-for-user-args.interface';

export type { AiCellar };

/**
 * Coupe-circuit unique, partagé par les chantiers A (fiche IA) et B (ajout
 * par photo) : IA disponible seulement si la cave l'autorise ET qu'une clé
 * API est configurée. Les deux routes IA revérifient ceci côté serveur —
 * jamais uniquement côté UI, qui l'utilise seulement pour masquer un bouton.
 */
export const isAiAvailable = (cellar: AiCellar): boolean => {
  return cellar.aiEnabled && hasApiKeyConfigured();
};

/**
 * Coupe-circuit équivalent à isAiAvailable, mais à la maille utilisateur
 * (pour la wishlist, qui n'appartient à aucune cave) : vrai si au moins une
 * des caves dont l'utilisateur est membre a l'IA activée, et qu'une clé API
 * est configurée. Revérifié côté serveur dans la route d'extraction dédiée
 * à la wishlist, jamais uniquement côté UI.
 */
export const isAiAvailableForUser = async ({ db, userId }: IsAiAvailableForUserArgs): Promise<boolean> => {
  if (!hasApiKeyConfigured()) {
    return false;
  }
  const rows = await db
    .select({ aiEnabled: cellars.aiEnabled })
    .from(cellarMemberships)
    .innerJoin(cellars, eq(cellarMemberships.cellarId, cellars.id))
    .where(eq(cellarMemberships.userId, userId));
  return rows.some((row) => row.aiEnabled);
};
