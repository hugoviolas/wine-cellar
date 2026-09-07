import { randomBytes } from 'node:crypto';

/** Token à usage unique (invitation, reset de mot de passe) — jamais devinable. */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
