import type { LogFields } from './interfaces/log-fields.interface';

type LogLevel = 'info' | 'warn' | 'error';

/**
 * Point de sortie unique des logs applicatifs. L'implémentation écrit sur
 * la sortie standard du conteneur — `docker compose logs` est le seul
 * collecteur en place aujourd'hui — mais tout passe par ici, donc la
 * remplacer (fichier, service externe) ne touchera pas les appelants.
 *
 * Le contexte est un objet plutôt qu'une chaîne libre : une ligne reste
 * lisible telle quelle et redevient analysable si la sortie part un jour
 * vers un agrégateur.
 */
const write = (level: LogLevel, message: string, fields?: LogFields): void => {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(fields ?? {}),
  });
  // eslint-disable-next-line no-console -- seule écriture console autorisée : c'est l'implémentation du logger lui-même.
  console[level](line);
};

export const logger = {
  info: (message: string, fields?: LogFields): void => {
    write('info', message, fields);
  },
  warn: (message: string, fields?: LogFields): void => {
    write('warn', message, fields);
  },
  error: (message: string, fields?: LogFields): void => {
    write('error', message, fields);
  },
};

/**
 * Un `catch (e: unknown)` ne garantit rien sur ce qu'il attrape : une
 * valeur lancée peut être n'importe quoi. Cette fonction en tire de quoi
 * remplir un log sans jamais supposer qu'il s'agit d'une `Error`.
 */
export const describeError = (error: unknown): LogFields => {
  if (error instanceof Error) {
    return { error: error.message, errorName: error.name, stack: error.stack };
  }
  return { error: String(error) };
};
