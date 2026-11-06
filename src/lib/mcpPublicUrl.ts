const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

/**
 * Adresse publique de l'app vue par Claude (`MCP_PUBLIC_URL`), ou `null`
 * si le serveur MCP n'est pas activé sur ce déploiement.
 *
 * Opt-in par environnement plutôt que déduit de l'en-tête `Host` : c'est
 * l'identifiant de l'émetteur OAuth, que le client compare à l'adresse
 * qu'il a découverte, et un en-tête se falsifie. La préprod, servie en
 * HTTP sur le réseau local, que claude.ai ne peut de toute façon pas
 * joindre, n'a qu'à ne pas la définir : toutes les routes MCP et OAuth y
 * répondent 404.
 *
 * Lue à l'appel et pas au chargement du module, pour la même raison que
 * SESSION_SECRET (voir domain/session.ts) : `next build` importe les routes
 * sans `.env`.
 */
export const getMcpPublicUrl = (): URL | null => {
  const raw = process.env.MCP_PUBLIC_URL?.trim();
  if (!raw) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`MCP_PUBLIC_URL n'est pas une adresse valide (voir .env.example).`);
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
  if (!secure) {
    throw new Error('MCP_PUBLIC_URL doit être en https (http seulement pour localhost).');
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(
      "MCP_PUBLIC_URL doit être la racine de l'app, sans chemin (ex. https://cave.example.com).",
    );
  }
  return url;
};
