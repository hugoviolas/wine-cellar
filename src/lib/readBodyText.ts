import type { ReadBodyTextArgs } from './interfaces/read-body-text-args.interface';

/** Corps de requête au-delà de la taille admise par la route. */
export class BodyTooLargeError extends Error {}

/**
 * Lit le corps d'une requête en texte, en s'arrêtant dès que `maxBytes` est
 * dépassé. Les route handlers n'imposent aucune taille maximale (voir
 * domain/fieldLimits.ts) : `request.text()` chargerait en mémoire tout ce
 * qu'un client envoie avant qu'on ait pu le refuser. Ici le flux est lu
 * morceau par morceau et coupé au premier octet de trop — `Content-Length`
 * n'est qu'un premier filtre, un client peut l'omettre ou mentir.
 */
export const readBodyText = async ({ request, maxBytes }: ReadBodyTextArgs): Promise<string> => {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) {
    throw new BodyTooLargeError();
  }
  if (!request.body) {
    return '';
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};
