import { hasApiKeyConfigured } from '../supervision';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { cellarMemberships, cellars } from '../../db/schema';

export interface AiCellar {
  aiEnabled: boolean;
}

/**
 * Coupe-circuit unique, partagé par les chantiers A (fiche IA) et B (ajout
 * par photo) : IA disponible seulement si la cave l'autorise ET qu'une clé
 * API est configurée. Les deux routes IA revérifient ceci côté serveur —
 * jamais uniquement côté UI, qui l'utilise seulement pour masquer un bouton.
 */
export function isAiAvailable(cellar: AiCellar): boolean {
  return cellar.aiEnabled && hasApiKeyConfigured();
}

/**
 * Coupe-circuit équivalent à isAiAvailable, mais à la maille utilisateur
 * (pour la wishlist, qui n'appartient à aucune cave) : vrai si au moins une
 * des caves dont l'utilisateur est membre a l'IA activée, et qu'une clé API
 * est configurée. Revérifié côté serveur dans la route d'extraction dédiée
 * à la wishlist, jamais uniquement côté UI.
 */
export async function isAiAvailableForUser(db: Db, userId: string): Promise<boolean> {
  if (!hasApiKeyConfigured()) return false;
  const rows = await db
    .select({ aiEnabled: cellars.aiEnabled })
    .from(cellarMemberships)
    .innerJoin(cellars, eq(cellarMemberships.cellarId, cellars.id))
    .where(eq(cellarMemberships.userId, userId));
  return rows.some((row) => row.aiEnabled);
}
