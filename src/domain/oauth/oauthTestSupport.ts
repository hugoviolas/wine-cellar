import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { newId } from '../../db/id';
import { registerClient } from './clients';
import { checkAuthorizationRequest, issueAuthorizationCode } from './authorization';
import type { RegisteredClient } from './interfaces/registered-client.interface';
import type { PkcePair } from './interfaces/pkce-pair.interface';
import type { TestAuthorizationArgs } from './interfaces/test-authorization-args.interface';

/**
 * Outils de test du serveur OAuth. Réservés aux tests, comme
 * db/testRows.ts : rien ici ne doit être importé par du code applicatif.
 */

export const TEST_RESOURCE_URL = 'https://cave.example.com/mcp';
export const TEST_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

/**
 * Compte inséré directement, sans passer par bcrypt : ces tests portent sur
 * les jetons, pas sur la vérification du mot de passe, et un hachage en
 * coût 12 par test ralentirait la suite pour rien.
 */
export const insertTestUser = async (db: Db, email = 'claude@example.com'): Promise<string> => {
  const id = newId();
  await db.insert(users).values({
    id,
    email,
    passwordHash: 'non-utilisé',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  });
  return id;
};

export const createPkcePair = (): PkcePair => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

export const registerTestClient = async (
  db: Db,
  tokenEndpointAuthMethod: RegisteredClient['token_endpoint_auth_method'] = 'none',
): Promise<RegisteredClient> => {
  return registerClient({
    db,
    input: { redirectUris: [TEST_REDIRECT_URI], clientName: 'Claude', tokenEndpointAuthMethod },
  });
};

/** Parcourt la demande d'autorisation jusqu'au code, comme la page le ferait. */
export const authorizeForTest = async ({
  db,
  clientId,
  userId,
  pkce,
}: TestAuthorizationArgs): Promise<string> => {
  const check = await checkAuthorizationRequest({
    db,
    resourceUrl: TEST_RESOURCE_URL,
    params: {
      client_id: clientId,
      redirect_uri: TEST_REDIRECT_URI,
      response_type: 'code',
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      state: 'etat-test',
    },
  });
  if (check.status !== 'ok') {
    throw new Error(`Demande d'autorisation refusée dans un test : ${check.status}`);
  }
  const redirectUrl = await issueAuthorizationCode({ db, request: check.request, userId });
  const code = new URL(redirectUrl).searchParams.get('code');
  if (code === null) {
    throw new Error("Pas de code dans l'adresse de retour.");
  }
  return code;
};
