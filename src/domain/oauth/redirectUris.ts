/**
 * Hôtes vers lesquels un code d'autorisation peut être renvoyé.
 *
 * L'enregistrement des clients est ouvert (c'est ce qu'attend claude.ai),
 * et l'inscription à l'app aussi : sans cette liste, n'importe qui pourrait
 * enregistrer un client pointant vers son propre site, puis envoyer à un
 * utilisateur un lien vers la vraie page d'autorisation de la cave. Le mot
 * de passe y serait saisi sur le bon domaine, et le code partirait chez
 * l'attaquant. Restreindre les retours à Claude ferme cette porte.
 *
 * - claude.ai / claude.com, en https : le connecteur de claude.ai (web,
 *   mobile, desktop).
 * - la boucle locale, en http : Claude Code et MCP Inspector, qui
 *   reçoivent le code sur un port local. Un attaquant n'a pas accès à la
 *   machine de sa victime, donc pas à ce port.
 */
const TRUSTED_HTTPS_HOSTS: ReadonlySet<string> = new Set(['claude.ai', 'claude.com']);
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

export const isAllowedRedirectUri = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Interdits par la RFC 6749 (§3.1.2) pour le fragment ; les
  // identifiants dans l'URL n'ont rien à faire dans une adresse de retour.
  if (url.hash !== '' || url.username !== '' || url.password !== '') {
    return false;
  }
  if (url.protocol === 'https:') {
    return TRUSTED_HTTPS_HOSTS.has(url.hostname) && url.port === '';
  }
  if (url.protocol === 'http:') {
    return LOOPBACK_HOSTS.has(url.hostname);
  }
  return false;
};
