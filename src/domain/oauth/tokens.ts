import { and, eq, lt } from 'drizzle-orm';
import { oauthCodes, oauthTokens, users } from '../../db/schema';
import { newId } from '../../db/id';
import { generateToken, hashToken } from '../token';
import { isSessionStillValid } from '../sessionValidity';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { OAuthError } from './oauthError';
import { verifyCodeVerifier } from './secrets';
import { OAUTH_DURATIONS_MS } from './settings';
import type { IssuedTokens } from './interfaces/issued-tokens.interface';
import type { IssueTokensArgs } from './interfaces/issue-tokens-args.interface';
import type { ExchangeAuthorizationCodeArgs } from './interfaces/exchange-authorization-code-args.interface';
import type { RefreshTokensArgs } from './interfaces/refresh-tokens-args.interface';
import type { RevokeTokenArgs } from './interfaces/revoke-token-args.interface';
import type { VerifyAccessTokenArgs } from './interfaces/verify-access-token-args.interface';
import type { GrantOwnerArgs } from './interfaces/grant-owner-args.interface';

export type { IssuedTokens };

/**
 * Échange un code d'autorisation contre une paire de jetons.
 *
 * Le code est supprimé dès qu'il est présenté, avant même d'être vérifié :
 * un code intercepté puis rejoué (avec un mauvais verifier, ou après le
 * client légitime) ne sert jamais deux fois. Hors transaction à dessein —
 * une erreur ensuite annulerait la suppression. Deux échanges simultanés
 * du même code se départagent sur le nombre de lignes supprimées.
 */
export const exchangeAuthorizationCode = async ({
  db,
  client,
  code,
  codeVerifier,
  redirectUri,
}: ExchangeAuthorizationCodeArgs): Promise<IssuedTokens> => {
  const codeHash = hashToken(code);
  const [row] = await db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, codeHash)).limit(1);
  if (!row) {
    throw invalidGrant();
  }
  const consumed = await db.delete(oauthCodes).where(eq(oauthCodes.codeHash, codeHash));
  if (consumed.rowsAffected === 0) {
    throw invalidGrant();
  }

  const valid =
    row.clientId === client.id &&
    !isExpired(row.expiresAt) &&
    // Facultatif en OAuth 2.1 ; s'il est fourni, il doit être celui de la
    // demande (RFC 6749 §4.1.3).
    (redirectUri === null || redirectUri === row.redirectUri) &&
    verifyCodeVerifier({ verifier: codeVerifier, challenge: row.codeChallenge });
  if (!valid) {
    throw invalidGrant();
  }

  const owner = await findGrantOwner({ db, userId: row.userId, grantedAt: row.createdAt });
  if (!owner) {
    throw invalidGrant();
  }
  return issueTokens({
    db,
    clientId: client.id,
    userId: owner.id,
    grantId: newId(),
    grantedAt: row.createdAt,
  });
};

/**
 * Renouvelle une paire de jetons. Le refresh token présenté est consommé et
 * la paire précédente supprimée : un refresh token volé puis utilisé par
 * l'attaquant fait échouer le renouvellement suivant du client légitime,
 * qui devra se reconnecter — la fuite se voit au lieu de durer.
 */
export const refreshTokens = async ({
  db,
  client,
  refreshToken,
}: RefreshTokensArgs): Promise<IssuedTokens> => {
  const tokenHash = hashToken(refreshToken);
  const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.tokenHash, tokenHash)).limit(1);
  if (!row || row.kind !== 'refresh' || row.clientId !== client.id || isExpired(row.expiresAt)) {
    throw invalidGrant();
  }

  const owner = await findGrantOwner({ db, userId: row.userId, grantedAt: row.grantedAt });
  if (!owner) {
    // Compte désactivé ou mot de passe réinitialisé depuis l'autorisation :
    // l'autorisation entière tombe, pas seulement ce renouvellement.
    await db.delete(oauthTokens).where(eq(oauthTokens.grantId, row.grantId));
    throw invalidGrant();
  }

  return db.transaction(async (tx) => {
    const consumed = await tx.delete(oauthTokens).where(eq(oauthTokens.tokenHash, tokenHash));
    if (consumed.rowsAffected === 0) {
      // Déjà consommé par un renouvellement concurrent.
      throw invalidGrant();
    }
    await tx.delete(oauthTokens).where(eq(oauthTokens.grantId, row.grantId));
    return issueTokens({
      db: tx,
      clientId: client.id,
      userId: owner.id,
      grantId: row.grantId,
      grantedAt: row.grantedAt,
    });
  });
};

/**
 * Utilisateur au nom duquel agit un jeton d'accès, ou `null` si le jeton
 * est inconnu, expiré, ou si son autorisation ne vaut plus (compte
 * désactivé ou supprimé, mot de passe réinitialisé depuis).
 */
export const verifyAccessToken = async ({
  db,
  token,
}: VerifyAccessTokenArgs): Promise<AuthenticatedUser | null> => {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, hashToken(token)), eq(oauthTokens.kind, 'access')))
    .limit(1);
  if (!row || isExpired(row.expiresAt)) {
    return null;
  }
  return findGrantOwner({ db, userId: row.userId, grantedAt: row.grantedAt });
};

/**
 * Révocation (RFC 7009) : quel que soit le jeton présenté, c'est toute
 * l'autorisation qui tombe — un client qui se déconnecte ne doit pas
 * laisser derrière lui un jeton d'accès encore valide. Un jeton inconnu
 * ou appartenant à un autre client est ignoré sans erreur, comme le
 * prévoit la RFC.
 */
export const revokeToken = async ({ db, client, token }: RevokeTokenArgs): Promise<void> => {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.tokenHash, hashToken(token)))
    .limit(1);
  if (row?.clientId === client.id) {
    await db.delete(oauthTokens).where(eq(oauthTokens.grantId, row.grantId));
  }
};

const issueTokens = async ({
  db,
  clientId,
  userId,
  grantId,
  grantedAt,
}: IssueTokensArgs): Promise<IssuedTokens> => {
  const now = new Date();
  // Même balayage que pour les codes : les jetons expirés ne servent plus à
  // rien, autant les retirer à l'occasion d'une émission.
  await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now.toISOString()));

  const accessToken = generateToken();
  const refreshToken = generateToken();
  const common = { grantId, clientId, userId, grantedAt, createdAt: now.toISOString() };
  await db.insert(oauthTokens).values([
    {
      ...common,
      tokenHash: hashToken(accessToken),
      kind: 'access',
      expiresAt: new Date(now.getTime() + OAUTH_DURATIONS_MS.accessToken).toISOString(),
    },
    {
      ...common,
      tokenHash: hashToken(refreshToken),
      kind: 'refresh',
      expiresAt: new Date(now.getTime() + OAUTH_DURATIONS_MS.refreshToken).toISOString(),
    },
  ]);

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: OAUTH_DURATIONS_MS.accessToken / 1000,
    refresh_token: refreshToken,
  };
};

/**
 * Titulaire d'une autorisation, s'il peut encore s'en servir. Mêmes règles
 * que pour une session de l'app (voir requireApiUser) : compte actif, et
 * autorisation donnée après la dernière réinitialisation de mot de passe.
 */
const findGrantOwner = async ({
  db,
  userId,
  grantedAt,
}: GrantOwnerArgs): Promise<AuthenticatedUser | null> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.isActive || !isSessionStillValid({ user, issuedAt: grantedAt })) {
    return null;
  }
  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
};

const isExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt).getTime() <= Date.now();
};

const invalidGrant = (): OAuthError => {
  return new OAuthError('invalid_grant', 'Code ou jeton invalide, expiré ou déjà utilisé.');
};
