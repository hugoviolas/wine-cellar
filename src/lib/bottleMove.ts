import { readJsonBody } from './readJsonBody';
import { errorMessageFromResponse } from './apiError';
import type { RequestBottleMoveArgs } from './interfaces/request-bottle-move-args.interface';
import type { BottleMoveOutcome } from './interfaces/bottle-move-outcome.interface';
import type { ApplyBottleMoveArgs } from './interfaces/apply-bottle-move-args.interface';
import type { BottleMoveMessageArgs } from './interfaces/bottle-move-message-args.interface';
import type { MoveBottlesResult } from '@/domain/interfaces/move-bottles-result.interface';

export type { BottleMoveOutcome };

const parseMoveResult = (body: unknown): MoveBottlesResult | null => {
  if (typeof body !== 'object' || body === null || !('bottleId' in body) || !('merged' in body)) {
    return null;
  }
  const { bottleId, merged } = body;
  return typeof bottleId === 'string' && typeof merged === 'boolean' ? { bottleId, merged } : null;
};

/** Appelle `POST /api/bottles/[id]/move` — seul chemin de déplacement, depuis la fiche comme depuis la cave. */
export const requestBottleMove = async ({
  bottleId,
  crateId,
  quantity,
}: RequestBottleMoveArgs): Promise<BottleMoveOutcome> => {
  const response = await fetch(`/api/bottles/${bottleId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quantity === undefined ? { crateId } : { crateId, quantity }),
  });
  if (!response.ok) {
    const message = await errorMessageFromResponse({
      response,
      fallback: 'Impossible de déplacer ces bouteilles.',
    });
    return { ok: false, message };
  }
  return { ok: true, result: parseMoveResult(await readJsonBody(response)) };
};

/**
 * Reporte sur l'état local du tableau un déplacement accepté par le
 * serveur, avec les mêmes règles que `moveBottles` : le lot d'origine perd
 * les bouteilles (et disparaît s'il est vide), le lot cible les gagne s'il
 * existait (fusion), sinon un lot apparaît en fin de clayette.
 */
export const applyBottleMove = <T extends { readonly id: string; readonly quantity: number }>({
  bottlesByCrate,
  bottle,
  fromCrateId,
  toCrateId,
  quantity,
  result,
}: ApplyBottleMoveArgs<T>): Record<string, T[]> => {
  const remaining = bottle.quantity - quantity;
  const from = (bottlesByCrate[fromCrateId] ?? []).flatMap((item) => {
    if (item.id !== bottle.id) {
      return [item];
    }
    return remaining > 0 ? [{ ...item, quantity: remaining }] : [];
  });
  const to = bottlesByCrate[toCrateId] ?? [];
  const nextTo = result.merged
    ? to.map((item) => (item.id === result.bottleId ? { ...item, quantity: item.quantity + quantity } : item))
    : [...to, { ...bottle, id: result.bottleId, quantity }];
  const next: Record<string, T[]> = {};
  for (const [crateId, items] of Object.entries(bottlesByCrate)) {
    next[crateId] = [...items];
  }
  next[fromCrateId] = from;
  next[toCrateId] = nextTo;
  return next;
};

/** Confirmation affichée après un déplacement réussi. */
export const bottleMoveMessage = ({ quantity, merged, targetLabel }: BottleMoveMessageArgs): string => {
  const plural = quantity > 1 ? 's' : '';
  return merged
    ? `${quantity} bouteille${plural} regroupée${plural} avec celles de ${targetLabel}.`
    : `${quantity} bouteille${plural} déplacée${plural} vers ${targetLabel}.`;
};
