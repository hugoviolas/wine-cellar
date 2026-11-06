import { NextResponse } from 'next/server';
import { OAuthError } from '@/domain/oauth/oauthError';
import type { ClientCredentials } from '@/domain/oauth/interfaces/client-credentials.interface';
import { BodyTooLargeError, readBodyText } from './readBodyText';
import type { OAuthJsonArgs } from './interfaces/oauth-json-args.interface';
import type { ReadClientCredentialsArgs } from './interfaces/read-client-credentials-args.interface';

/** Une requête OAuth tient en quelques centaines d'octets. */
const MAX_OAUTH_BODY_BYTES = 16 * 1024;

/**
 * Les réponses OAuth transportent des jetons : aucun intermédiaire ne doit
 * les garder en cache (RFC 6749 §5.1).
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

export const oauthJson = ({ body, status = 200 }: OAuthJsonArgs): NextResponse => {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
};

/**
 * Erreur au format OAuth (`{ error, error_description }`). Un client qui
 * échoue à s'authentifier reçoit un 401 avec son défi `Basic` (RFC 6749
 * §5.2) ; tout le reste est un 400.
 */
export const oauthErrorResponse = (error: OAuthError): NextResponse => {
  const body = { error: error.code, error_description: error.message };
  if (error.code === 'invalid_client') {
    return NextResponse.json(body, {
      status: 401,
      headers: { ...NO_STORE_HEADERS, 'WWW-Authenticate': 'Basic realm="oauth"' },
    });
  }
  return NextResponse.json(body, { status: 400, headers: NO_STORE_HEADERS });
};

/** Route OAuth sur un déploiement où le MCP n'est pas activé. */
export const oauthDisabled = (): NextResponse => {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
};

/**
 * Paramètres d'une requête OAuth. Le protocole les veut en
 * `application/x-www-form-urlencoded` ; un corps JSON est aussi accepté,
 * certains clients l'envoyant ainsi. Seules les valeurs textuelles sont
 * gardées : c'est tout ce que le protocole définit.
 */
export const readOAuthParams = async (request: Request): Promise<Record<string, string>> => {
  let text: string;
  try {
    text = await readBodyText({ request, maxBytes: MAX_OAUTH_BODY_BYTES });
  } catch (error: unknown) {
    if (error instanceof BodyTooLargeError) {
      throw new OAuthError('invalid_request', 'Requête trop volumineuse.');
    }
    throw error;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new OAuthError('invalid_request', 'Corps JSON invalide.');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new OAuthError('invalid_request', 'Corps JSON invalide.');
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      params[key] = value;
    }
  }
  return params;
};

const BASIC_PATTERN = /^Basic\s+(\S+)$/i;

/**
 * Identité du client : en-tête `Authorization: Basic` (client_secret_basic)
 * ou champs `client_id` / `client_secret` du corps (client_secret_post, ou
 * client public qui n'envoie que son identifiant). Dans l'en-tête, les deux
 * valeurs sont encodées en form-urlencoded avant le base64 (RFC 6749
 * §2.3.1) : d'où le `decodeURIComponent`.
 */
export const readClientCredentials = ({ headers, params }: ReadClientCredentialsArgs): ClientCredentials => {
  const basic = BASIC_PATTERN.exec(headers.get('authorization') ?? '')?.[1];
  if (basic !== undefined) {
    const decoded = Buffer.from(basic, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator <= 0) {
      throw new OAuthError('invalid_client', 'Authentification client invalide.');
    }
    try {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    } catch {
      throw new OAuthError('invalid_client', 'Authentification client invalide.');
    }
  }
  const clientId = params.client_id;
  if (!clientId) {
    throw new OAuthError('invalid_client', 'client_id manquant.');
  }
  return { clientId, clientSecret: params.client_secret ?? null };
};
