import type { MoveBottlesResult } from '@/domain/interfaces/move-bottles-result.interface';

/**
 * Issue d'un déplacement côté client. `result` est `null` si le serveur a
 * accepté le déplacement mais renvoyé une réponse de forme inattendue : le
 * déplacement a bien eu lieu, seul le détail manque.
 */
export type BottleMoveOutcome =
  | { readonly ok: true; readonly result: MoveBottlesResult | null }
  | { readonly ok: false; readonly message: string };
