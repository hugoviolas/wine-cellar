import { hasApiKeyConfigured } from '../supervision';

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
