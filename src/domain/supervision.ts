import { statSync } from 'node:fs';

/** Taille du fichier SQLite en octets, ou `null` si le fichier n'existe pas
 * encore (ex : DATABASE_URL pointe vers `:memory:` ou un chemin inexistant). */
export function getDbFileSizeBytes(): number | null {
  const url = process.env.DATABASE_URL ?? 'file:./data/cave.db';
  const path = url.startsWith('file:') ? url.slice('file:'.length) : url;
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

export function hasApiKeyConfigured(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY.length > 0;
}
